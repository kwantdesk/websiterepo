using System.Globalization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using KwantDesk.Core.Collections;
using KwantDesk.Core.Models;
using SkiaSharp;
using SkiaSharp.Views.Desktop;
using SkiaSharp.Views.WPF;

namespace KwantDesk.Rendering;

/// <summary>
/// GPU-backed, allocation-conscious native candle renderer. Live data remains
/// in a fixed-capacity series and is copied into a reusable render buffer.
/// Rendering is paced by the desktop compositor and occurs only when market
/// state or viewport state changes.
/// </summary>
public sealed class KwantChartControl : SKGLElement
{
    private const int RenderCapacity = 20_000;
    private const float PriceAxisWidth = 92f;
    private const float TimeAxisHeight = 30f;
    private const float PlotPadding = 8f;
    private readonly Candle[] _renderBuffer = new Candle[RenderCapacity];
    private readonly SKPaint _backgroundPaint = new() { Style = SKPaintStyle.Fill, IsAntialias = false };
    private readonly SKPaint _plotPaint = new() { Style = SKPaintStyle.Fill, IsAntialias = false };
    private readonly SKPaint _gridPaint = new() { Style = SKPaintStyle.Stroke, StrokeWidth = 1f, IsAntialias = false };
    private readonly SKPaint _axisPaint = new() { Style = SKPaintStyle.Fill, IsAntialias = true };
    private readonly SKFont _axisFont = new(SKTypeface.Default, 12f);
    private readonly SKPaint _bullPaint = new() { Style = SKPaintStyle.Fill, IsAntialias = false };
    private readonly SKPaint _bearPaint = new() { Style = SKPaintStyle.Fill, IsAntialias = false };
    private readonly SKPaint _wickPaint = new() { Style = SKPaintStyle.Stroke, StrokeWidth = 1f, IsAntialias = false };
    private readonly SKPaint _accentPaint = new() { Style = SKPaintStyle.Stroke, StrokeWidth = 1f, IsAntialias = false };
    private readonly SKPaint _accentFillPaint = new() { Style = SKPaintStyle.Fill, IsAntialias = false };
    private readonly SKPaint _emptyPaint = new() { Style = SKPaintStyle.Fill, IsAntialias = true };
    private readonly SKFont _emptyFont = new(SKTypeface.Default, 13f);
    private readonly SKPaint _crosshairPaint = new() { Style = SKPaintStyle.Stroke, StrokeWidth = 1f, IsAntialias = false };
    private ChartTheme _theme = ChartTheme.MonoProtocol;
    private BoundedSeries<Candle>? _series;
    private long _renderedRevision = -1;
    private bool _viewportDirty = true;
    private bool _isDragging;
    private Point _lastPointer;
    private Point _crosshair;
    private bool _showCrosshair;
    private double _barsFromRight;
    private int _visibleBars = 140;
    private bool _disposed;

    public KwantChartControl()
    {
        Focusable = true;
        PaintSurface += PaintChart;
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        MouseLeftButtonDown += OnMouseLeftButtonDown;
        MouseLeftButtonUp += OnMouseLeftButtonUp;
        MouseMove += OnMouseMove;
        MouseLeave += OnMouseLeave;
        MouseWheel += OnMouseWheel;
        KeyDown += OnKeyDown;
        ApplyTheme();
    }

    public BoundedSeries<Candle>? Series
    {
        get => _series;
        set
        {
            if (ReferenceEquals(_series, value)) return;
            _series = value;
            _renderedRevision = -1;
            _viewportDirty = true;
            InvalidateVisual();
        }
    }

    public ChartTheme Theme
    {
        get => _theme;
        set
        {
            _theme = value ?? throw new ArgumentNullException(nameof(value));
            ApplyTheme();
            _viewportDirty = true;
            InvalidateVisual();
        }
    }

    public void ResetToLive()
    {
        _barsFromRight = 0;
        _viewportDirty = true;
        InvalidateVisual();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        CompositionTarget.Rendering += OnCompositionRendering;
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        CompositionTarget.Rendering -= OnCompositionRendering;
    }

    private void OnCompositionRendering(object? sender, EventArgs e)
    {
        if (!IsVisible || ActualWidth <= 0 || ActualHeight <= 0) return;
        var revision = _series?.Revision ?? -1;
        if (!_viewportDirty && revision == _renderedRevision) return;
        InvalidateVisual();
    }

    private void PaintChart(object? sender, SKPaintGLSurfaceEventArgs e)
    {
        var canvas = e.Surface.Canvas;
        var width = e.BackendRenderTarget.Width;
        var height = e.BackendRenderTarget.Height;
        canvas.Clear(_theme.Background);
        if (width <= PriceAxisWidth + PlotPadding * 2 || height <= TimeAxisHeight + PlotPadding * 2) return;

        var plot = new SKRect(0, 0, width - PriceAxisWidth, height - TimeAxisHeight);
        canvas.DrawRect(plot, _plotPaint);
        DrawGrid(canvas, plot);

        var series = _series;
        var copied = series?.CopyNewestTo(_renderBuffer) ?? 0;
        _renderedRevision = series?.Revision ?? -1;
        _viewportDirty = false;

        if (copied == 0)
        {
            DrawEmptyState(canvas, plot);
            return;
        }

        var offset = Math.Clamp((int)Math.Round(_barsFromRight), 0, Math.Max(0, copied - 1));
        var endExclusive = copied - offset;
        var start = Math.Max(0, endExclusive - _visibleBars);
        if (endExclusive <= start)
        {
            DrawEmptyState(canvas, plot);
            return;
        }

        var min = double.MaxValue;
        var max = double.MinValue;
        for (var index = start; index < endExclusive; index++)
        {
            var candle = _renderBuffer[index];
            min = Math.Min(min, candle.Low);
            max = Math.Max(max, candle.High);
        }

        if (!double.IsFinite(min) || !double.IsFinite(max)) return;
        var span = Math.Max(max - min, 0.25);
        var padding = span * 0.08;
        min -= padding;
        max += padding;

        DrawCandles(canvas, plot, start, endExclusive, min, max);
        DrawPriceAxis(canvas, plot, min, max);
        DrawTimeAxis(canvas, plot, start, endExclusive);
        DrawLastPrice(canvas, plot, _renderBuffer[endExclusive - 1].Close, min, max);
        if (_showCrosshair) DrawCrosshair(canvas, plot);
    }

    private void DrawGrid(SKCanvas canvas, SKRect plot)
    {
        const int horizontalLines = 6;
        const int verticalLines = 8;
        for (var row = 1; row < horizontalLines; row++)
        {
            var y = plot.Top + plot.Height * row / horizontalLines;
            canvas.DrawLine(plot.Left, y, plot.Right, y, _gridPaint);
        }

        for (var column = 1; column < verticalLines; column++)
        {
            var x = plot.Left + plot.Width * column / verticalLines;
            canvas.DrawLine(x, plot.Top, x, plot.Bottom, _gridPaint);
        }
    }

    private void DrawCandles(SKCanvas canvas, SKRect plot, int start, int endExclusive, double min, double max)
    {
        var count = endExclusive - start;
        var slot = plot.Width / Math.Max(count, 1);
        var bodyWidth = Math.Clamp(slot * 0.64f, 1f, 18f);
        var drawableHeight = plot.Height - PlotPadding * 2;
        for (var index = start; index < endExclusive; index++)
        {
            var candle = _renderBuffer[index];
            var x = plot.Left + slot * (index - start + 0.5f);
            var openY = PriceToY(candle.Open, plot, min, max, drawableHeight);
            var closeY = PriceToY(candle.Close, plot, min, max, drawableHeight);
            var highY = PriceToY(candle.High, plot, min, max, drawableHeight);
            var lowY = PriceToY(candle.Low, plot, min, max, drawableHeight);
            var isBullish = candle.Close >= candle.Open;
            _wickPaint.Color = isBullish ? _theme.Bullish : _theme.Bearish;
            canvas.DrawLine(x, highY, x, lowY, _wickPaint);

            var top = Math.Min(openY, closeY);
            var bottom = Math.Max(openY, closeY);
            if (bottom - top < 1f) bottom = top + 1f;
            var rect = new SKRect(x - bodyWidth / 2, top, x + bodyWidth / 2, bottom);
            canvas.DrawRect(rect, isBullish ? _bullPaint : _bearPaint);
        }
    }

    private void DrawPriceAxis(SKCanvas canvas, SKRect plot, double min, double max)
    {
        const int labels = 6;
        for (var row = 0; row <= labels; row++)
        {
            var ratio = row / (double)labels;
            var price = max - (max - min) * ratio;
            var y = plot.Top + plot.Height * (float)ratio;
            var text = price.ToString("N2", CultureInfo.InvariantCulture);
            canvas.DrawText(text, plot.Right + 10, y + 4, SKTextAlign.Left, _axisFont, _axisPaint);
        }
    }

    private void DrawTimeAxis(SKCanvas canvas, SKRect plot, int start, int endExclusive)
    {
        var count = endExclusive - start;
        if (count <= 0) return;
        const int labels = 6;
        for (var column = 0; column <= labels; column++)
        {
            var ratio = column / (double)labels;
            var index = Math.Clamp(start + (int)Math.Round((count - 1) * ratio), start, endExclusive - 1);
            var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(_renderBuffer[index].OpenTimeUnixMs).ToLocalTime();
            var text = timestamp.ToString("HH:mm", CultureInfo.InvariantCulture);
            var x = plot.Left + plot.Width * (float)ratio;
            var measured = _axisFont.MeasureText(text, _axisPaint);
            canvas.DrawText(text, Math.Clamp(x - measured / 2, 2, plot.Right - measured), plot.Bottom + 20, SKTextAlign.Left, _axisFont, _axisPaint);
        }
    }

    private void DrawLastPrice(SKCanvas canvas, SKRect plot, double price, double min, double max)
    {
        var y = PriceToY(price, plot, min, max, plot.Height - PlotPadding * 2);
        _accentPaint.PathEffect = SKPathEffect.CreateDash([4f, 4f], 0);
        canvas.DrawLine(plot.Left, y, plot.Right, y, _accentPaint);
        _accentPaint.PathEffect?.Dispose();
        _accentPaint.PathEffect = null;

        var text = price.ToString("N2", CultureInfo.InvariantCulture);
        var textWidth = _axisFont.MeasureText(text, _axisPaint);
        var box = new SKRect(plot.Right, y - 11, Math.Min(plot.Right + textWidth + 18, plot.Right + PriceAxisWidth), y + 11);
        canvas.DrawRect(box, _accentFillPaint);
        var original = _axisPaint.Color;
        _axisPaint.Color = _theme.Background;
        canvas.DrawText(text, plot.Right + 8, y + 4, SKTextAlign.Left, _axisFont, _axisPaint);
        _axisPaint.Color = original;
    }

    private void DrawCrosshair(SKCanvas canvas, SKRect plot)
    {
        var x = Math.Clamp((float)_crosshair.X, plot.Left, plot.Right);
        var y = Math.Clamp((float)_crosshair.Y, plot.Top, plot.Bottom);
        canvas.DrawLine(x, plot.Top, x, plot.Bottom, _crosshairPaint);
        canvas.DrawLine(plot.Left, y, plot.Right, y, _crosshairPaint);
    }

    private void DrawEmptyState(SKCanvas canvas, SKRect plot)
    {
        const string title = "WAITING FOR VPS MARKET DATA";
        const string detail = "No synthetic fallback is being rendered.";
        var titleWidth = _emptyFont.MeasureText(title, _emptyPaint);
        canvas.DrawText(title, plot.MidX - titleWidth / 2, plot.MidY - 8, SKTextAlign.Left, _emptyFont, _emptyPaint);
        var original = _emptyPaint.Color;
        _emptyPaint.Color = _theme.Muted;
        var detailWidth = _emptyFont.MeasureText(detail, _emptyPaint);
        canvas.DrawText(detail, plot.MidX - detailWidth / 2, plot.MidY + 18, SKTextAlign.Left, _emptyFont, _emptyPaint);
        _emptyPaint.Color = original;
    }

    private static float PriceToY(double price, SKRect plot, double min, double max, float drawableHeight)
    {
        var ratio = (max - price) / Math.Max(max - min, double.Epsilon);
        return plot.Top + PlotPadding + (float)ratio * drawableHeight;
    }

    private void OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        Focus();
        CaptureMouse();
        _isDragging = true;
        _lastPointer = e.GetPosition(this);
        e.Handled = true;
    }

    private void OnMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        _isDragging = false;
        ReleaseMouseCapture();
        e.Handled = true;
    }

    private void OnMouseMove(object sender, MouseEventArgs e)
    {
        var position = e.GetPosition(this);
        _crosshair = position;
        _showCrosshair = true;
        if (_isDragging)
        {
            var plotWidth = Math.Max(ActualWidth - PriceAxisWidth, 1);
            var pixelsPerBar = plotWidth / Math.Max(_visibleBars, 1);
            _barsFromRight = Math.Max(0, _barsFromRight + (_lastPointer.X - position.X) / Math.Max(pixelsPerBar, 0.5));
            _lastPointer = position;
        }

        _viewportDirty = true;
        e.Handled = true;
    }

    private void OnMouseLeave(object sender, MouseEventArgs e)
    {
        if (_isDragging) return;
        _showCrosshair = false;
        _viewportDirty = true;
    }

    private void OnMouseWheel(object sender, MouseWheelEventArgs e)
    {
        var factor = e.Delta > 0 ? 0.84 : 1.19;
        _visibleBars = Math.Clamp((int)Math.Round(_visibleBars * factor), 20, 2_000);
        _viewportDirty = true;
        e.Handled = true;
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.End) return;
        ResetToLive();
        e.Handled = true;
    }

    private void ApplyTheme()
    {
        _backgroundPaint.Color = _theme.Background;
        _plotPaint.Color = _theme.PlotBackground;
        _gridPaint.Color = _theme.Grid;
        _axisPaint.Color = _theme.AxisText;
        _bullPaint.Color = _theme.Bullish;
        _bearPaint.Color = _theme.Bearish;
        _accentPaint.Color = _theme.Accent;
        _accentFillPaint.Color = _theme.Accent;
        _emptyPaint.Color = _theme.AxisText;
        _crosshairPaint.Color = _theme.Muted.WithAlpha(160);
    }

    public new void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        CompositionTarget.Rendering -= OnCompositionRendering;
        PaintSurface -= PaintChart;
        _backgroundPaint.Dispose();
        _plotPaint.Dispose();
        _gridPaint.Dispose();
        _axisPaint.Dispose();
        _axisFont.Dispose();
        _bullPaint.Dispose();
        _bearPaint.Dispose();
        _wickPaint.Dispose();
        _accentPaint.Dispose();
        _accentFillPaint.Dispose();
        _emptyPaint.Dispose();
        _emptyFont.Dispose();
        _crosshairPaint.Dispose();
        base.Dispose();
    }
}
