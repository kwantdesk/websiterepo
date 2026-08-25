using System.Net;
using System.Net.Http;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using KwantDesk.MarketData.Gateway;
using KwantDesk.MarketData.Rithmic;
using KwantDesk.MarketData.Sessions;

namespace KwantDesk.Workstation;

public partial class MainWindow : Window
{
    private readonly HttpClient _httpClient;
    private readonly MarketDataSession _marketDataSession;
    private readonly DispatcherTimer _heartbeat;
    private bool _isClosing;
    private bool _closeCompleted;

    public MainWindow()
    {
        InitializeComponent();

        var handler = new SocketsHttpHandler
        {
            AutomaticDecompression = DecompressionMethods.All,
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(10),
            PooledConnectionLifetime = TimeSpan.FromHours(1),
            MaxConnectionsPerServer = 4,
            EnableMultipleHttp2Connections = false,
        };
        _httpClient = new HttpClient(handler)
        {
            Timeout = Timeout.InfiniteTimeSpan,
        };

        var options = GatewayConnectionOptions.FromEnvironment();
        var tokenProvider = new EnvironmentAccessTokenProvider();
        var sse = new SseClient(_httpClient, tokenProvider);
        var trades = new RithmicTradeStreamClient(options, sse);
        _marketDataSession = new MarketDataSession(trades, "CME", "NQ", TimeSpan.FromMinutes(1));
        Chart.Series = _marketDataSession.Candles;
        _marketDataSession.StatusChanged += MarketDataSession_OnStatusChanged;

        _heartbeat = new DispatcherTimer(DispatcherPriority.Background)
        {
            Interval = TimeSpan.FromSeconds(1),
        };
        _heartbeat.Tick += Heartbeat_OnTick;

        Loaded += MainWindow_OnLoaded;
        Closing += MainWindow_OnClosing;
    }

    private async void MainWindow_OnLoaded(object sender, RoutedEventArgs e)
    {
        _heartbeat.Start();
        await _marketDataSession.StartAsync();
        ApplyStatus();
    }

    private void MarketDataSession_OnStatusChanged(object? sender, EventArgs e)
    {
        _ = Dispatcher.InvokeAsync(ApplyStatus, DispatcherPriority.Background);
    }

    private void ApplyStatus()
    {
        var status = _marketDataSession.Status;
        ConnectionText.Text = status;
        var color = status switch
        {
            "LIVE" => Color.FromRgb(181, 255, 0),
            "CONNECTING" or "RECONNECTING" => Color.FromRgb(255, 184, 0),
            "AUTH REQUIRED" => Color.FromRgb(255, 77, 109),
            _ => Color.FromRgb(96, 106, 115),
        };
        ConnectionDot.Fill = new SolidColorBrush(color);
        ConnectionBadge.BorderBrush = new SolidColorBrush(Color.FromArgb(100, color.R, color.G, color.B));
        StatusDetail.Text = string.IsNullOrWhiteSpace(_marketDataSession.LastError)
            ? $"VPS · {_marketDataSession.Exchange}:{_marketDataSession.ContractSymbol} · {_marketDataSession.Candles.Count:N0} bounded candles"
            : _marketDataSession.LastError;
    }

    private void Heartbeat_OnTick(object? sender, EventArgs e)
    {
        var lastTick = _marketDataSession.LastTickAtUnixMs;
        var age = lastTick <= 0
            ? "NO TICK"
            : $"LAST TICK {(DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeMilliseconds(lastTick)).TotalSeconds:0.0}s";
        HeartbeatText.Text = $"{age}  ·  HEAP {GC.GetTotalMemory(false) / 1_048_576d:0.0} MB  ·  {DateTimeOffset.Now:HH:mm:ss}";
    }

    private void LiveButton_OnClick(object sender, RoutedEventArgs e)
    {
        Chart.ResetToLive();
        Chart.Focus();
    }

    private async void MainWindow_OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (_closeCompleted) return;
        e.Cancel = true;
        if (_isClosing) return;

        _isClosing = true;
        try
        {
            _heartbeat.Stop();
            _marketDataSession.StatusChanged -= MarketDataSession_OnStatusChanged;
            await _marketDataSession.DisposeAsync();
            Chart.Dispose();
            _httpClient.Dispose();
        }
        finally
        {
            _closeCompleted = true;
            Closing -= MainWindow_OnClosing;
            Close();
        }
    }
}
