namespace KwantDesk.MarketData.Sessions;

/// <summary>
/// Process-wide subscription owner. Every panel requesting the same normalized
/// instrument and interval receives the same bounded session and therefore the
/// same upstream VPS connection.
/// </summary>
public sealed class SharedMarketDataHub(
    Func<MarketDataSubscriptionKey, IMarketDataSession> sessionFactory) : IAsyncDisposable
{
    private readonly object _gate = new();
    private readonly Dictionary<MarketDataSubscriptionKey, Entry> _entries = [];
    private bool _disposed;

    public async ValueTask<MarketDataLease> AcquireAsync(
        MarketDataSubscriptionKey key,
        CancellationToken cancellationToken = default)
    {
        Entry entry;
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            if (!_entries.TryGetValue(key, out entry!))
            {
                var session = sessionFactory(key);
                entry = new Entry(session);
                _entries.Add(key, entry);
            }

            checked { entry.ReferenceCount++; }
        }

        try
        {
            await entry.StartTask.Value.WaitAsync(cancellationToken).ConfigureAwait(false);
            return new MarketDataLease(this, key, entry);
        }
        catch
        {
            await ReleaseAsync(key, entry).ConfigureAwait(false);
            throw;
        }
    }

    private async ValueTask ReleaseAsync(MarketDataSubscriptionKey key, Entry entry)
    {
        var dispose = false;
        lock (_gate)
        {
            if (!_entries.TryGetValue(key, out var current) || !ReferenceEquals(current, entry)) return;
            if (entry.ReferenceCount <= 0) return;

            entry.ReferenceCount--;
            if (entry.ReferenceCount == 0)
            {
                _entries.Remove(key);
                dispose = true;
            }
        }

        if (dispose) await entry.Session.DisposeAsync().ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync()
    {
        Entry[] entries;
        lock (_gate)
        {
            if (_disposed) return;
            _disposed = true;
            entries = [.. _entries.Values];
            _entries.Clear();
        }

        foreach (var entry in entries)
        {
            await entry.Session.DisposeAsync().ConfigureAwait(false);
        }
    }

    internal sealed class Entry(IMarketDataSession session)
    {
        public IMarketDataSession Session { get; } = session;
        public Lazy<Task> StartTask { get; } = new(
            () => session.StartAsync(CancellationToken.None),
            LazyThreadSafetyMode.ExecutionAndPublication);
        public int ReferenceCount { get; set; }
    }

    public sealed class MarketDataLease : IAsyncDisposable
    {
        private SharedMarketDataHub? _owner;
        private readonly MarketDataSubscriptionKey _key;
        private readonly Entry _entry;

        internal MarketDataLease(
            SharedMarketDataHub owner,
            MarketDataSubscriptionKey key,
            Entry entry)
        {
            _owner = owner;
            _key = key;
            _entry = entry;
        }

        public IMarketDataSession Session => _entry.Session;

        public async ValueTask DisposeAsync()
        {
            var owner = Interlocked.Exchange(ref _owner, null);
            if (owner is not null) await owner.ReleaseAsync(_key, _entry).ConfigureAwait(false);
        }
    }
}
