using System.Threading;

namespace KwantDesk.Core.Collections;

/// <summary>
/// Fixed-capacity, overwrite-on-full series for live market state. The backing
/// array never grows, which makes memory use independent of session duration.
/// </summary>
public sealed class BoundedSeries<T> : IDisposable
{
    private readonly T[] _items;
    private readonly ReaderWriterLockSlim _gate = new(LockRecursionPolicy.NoRecursion);
    private int _start;
    private int _count;
    private long _revision;
    private bool _disposed;

    public BoundedSeries(int capacity)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(capacity, 1);
        Capacity = capacity;
        _items = new T[capacity];
    }

    public int Capacity { get; }

    public long Revision => Interlocked.Read(ref _revision);

    public int Count
    {
        get
        {
            _gate.EnterReadLock();
            try { return _count; }
            finally { _gate.ExitReadLock(); }
        }
    }

    public void Add(T value)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        _gate.EnterWriteLock();
        try
        {
            if (_count < Capacity)
            {
                _items[(_start + _count) % Capacity] = value;
                _count++;
                Interlocked.Increment(ref _revision);
                return;
            }

            _items[_start] = value;
            _start = (_start + 1) % Capacity;
            Interlocked.Increment(ref _revision);
        }
        finally { _gate.ExitWriteLock(); }
    }

    public bool ReplaceLast(T value)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        _gate.EnterWriteLock();
        try
        {
            if (_count == 0) return false;
            _items[(_start + _count - 1) % Capacity] = value;
            Interlocked.Increment(ref _revision);
            return true;
        }
        finally { _gate.ExitWriteLock(); }
    }

    public T[] Snapshot()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        _gate.EnterReadLock();
        try
        {
            var result = new T[_count];
            if (_count == 0) return result;

            var firstLength = Math.Min(_count, Capacity - _start);
            Array.Copy(_items, _start, result, 0, firstLength);
            if (firstLength < _count)
            {
                Array.Copy(_items, 0, result, firstLength, _count - firstLength);
            }

            return result;
        }
        finally { _gate.ExitReadLock(); }
    }

    /// <summary>
    /// Copies the newest values into caller-owned storage without allocating.
    /// When the destination is smaller than the series, only the newest values
    /// are copied. Native renderers use this instead of allocating per frame.
    /// </summary>
    public int CopyNewestTo(Span<T> destination)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        _gate.EnterReadLock();
        try
        {
            var copyCount = Math.Min(_count, destination.Length);
            if (copyCount == 0) return 0;

            var skip = _count - copyCount;
            var sourceStart = (_start + skip) % Capacity;
            var firstLength = Math.Min(copyCount, Capacity - sourceStart);
            _items.AsSpan(sourceStart, firstLength).CopyTo(destination);
            if (firstLength < copyCount)
            {
                _items.AsSpan(0, copyCount - firstLength).CopyTo(destination[firstLength..]);
            }

            return copyCount;
        }
        finally { _gate.ExitReadLock(); }
    }

    public void Clear()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        _gate.EnterWriteLock();
        try
        {
            Array.Clear(_items);
            _start = 0;
            _count = 0;
            Interlocked.Increment(ref _revision);
        }
        finally { _gate.ExitWriteLock(); }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _gate.Dispose();
    }
}
