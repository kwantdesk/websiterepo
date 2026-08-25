using SkiaSharp;

namespace KwantDesk.Rendering;

public sealed record ChartTheme(
    SKColor Background,
    SKColor PlotBackground,
    SKColor Grid,
    SKColor AxisText,
    SKColor Bullish,
    SKColor Bearish,
    SKColor Accent,
    SKColor Muted)
{
    public static ChartTheme MonoProtocol { get; } = new(
        SKColor.Parse("#050607"),
        SKColor.Parse("#07090B"),
        SKColor.Parse("#1B2025"),
        SKColor.Parse("#AEB8C2"),
        SKColor.Parse("#F4F6F8"),
        SKColor.Parse("#70777E"),
        SKColor.Parse("#B5FF00"),
        SKColor.Parse("#606A73"));
}
