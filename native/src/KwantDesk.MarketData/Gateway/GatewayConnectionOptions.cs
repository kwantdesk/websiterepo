namespace KwantDesk.MarketData.Gateway;

public sealed record GatewayConnectionOptions(Uri BaseUri)
{
    public static GatewayConnectionOptions FromEnvironment()
    {
        var configured = Environment.GetEnvironmentVariable("KWANTDESK_MARKET_DATA_GATEWAY_URL");
        return new GatewayConnectionOptions(new Uri(
            string.IsNullOrWhiteSpace(configured) ? "https://feed.kwantdesk.com/" : configured,
            UriKind.Absolute));
    }
}
