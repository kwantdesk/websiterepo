namespace KwantDesk.Core.Models;

public sealed record InstrumentSpec(
    string Root,
    string DisplayName,
    string Exchange,
    double TickSize,
    decimal TickValue,
    decimal PointValue,
    bool IsMicro)
{
    public static InstrumentSpec Nq { get; } = new("NQ", "E-mini Nasdaq-100", "CME", 0.25, 5m, 20m, false);
    public static InstrumentSpec Mnq { get; } = new("MNQ", "Micro E-mini Nasdaq-100", "CME", 0.25, 0.50m, 2m, true);
    public static InstrumentSpec Es { get; } = new("ES", "E-mini S&P 500", "CME", 0.25, 12.50m, 50m, false);
    public static InstrumentSpec Mes { get; } = new("MES", "Micro E-mini S&P 500", "CME", 0.25, 1.25m, 5m, true);

    public static InstrumentSpec Resolve(string root) => root.Trim().ToUpperInvariant() switch
    {
        "NQ" => Nq,
        "MNQ" => Mnq,
        "ES" => Es,
        "MES" => Mes,
        _ => throw new ArgumentOutOfRangeException(nameof(root), root, "Unsupported instrument root."),
    };
}
