namespace KwantDesk.MarketData.Gateway;

public interface IAccessTokenProvider
{
    ValueTask<string?> GetAccessTokenAsync(CancellationToken cancellationToken);
}

/// <summary>
/// Development bridge only. Reads an already-issued session or gateway token
/// from the process environment and never writes it to disk or application
/// settings. Production will replace this with browser PKCE + short-lived VPS
/// tickets without changing the market-data client.
/// </summary>
public sealed class EnvironmentAccessTokenProvider : IAccessTokenProvider
{
    public ValueTask<string?> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var token = Environment.GetEnvironmentVariable("KWANTDESK_DESKTOP_SESSION_TOKEN");
        if (string.IsNullOrWhiteSpace(token))
        {
            token = Environment.GetEnvironmentVariable("KWANTDESK_MARKET_DATA_GATEWAY_TOKEN");
        }

        return ValueTask.FromResult(string.IsNullOrWhiteSpace(token) ? null : token.Trim());
    }
}
