using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;

namespace KwantDesk.MarketData.Gateway;

public sealed class SseClient(HttpClient httpClient, IAccessTokenProvider tokenProvider)
{
    public async IAsyncEnumerable<SseMessage> ConnectAsync(
        Uri requestUri,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
        var token = await tokenProvider.GetAccessTokenAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new GatewayAuthenticationException(
                "No native session token is available. Sign-in ticket issuance is required before connecting directly to the VPS.");
        }

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        using var reader = new StreamReader(stream, Encoding.UTF8, false, 64 * 1024, leaveOpen: false);
        var eventName = "message";
        var data = new StringBuilder(1024);

        while (!cancellationToken.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false);
            if (line is null) yield break;
            if (line.Length == 0)
            {
                if (data.Length > 0)
                {
                    yield return new SseMessage(eventName, data.ToString());
                    data.Clear();
                    eventName = "message";
                }

                continue;
            }

            if (line[0] == ':') continue;
            if (line.StartsWith("event:", StringComparison.Ordinal))
            {
                eventName = line[6..].Trim();
                continue;
            }

            if (!line.StartsWith("data:", StringComparison.Ordinal)) continue;
            if (data.Length > 0) data.Append('\n');
            data.Append(line.AsSpan(5).TrimStart());
        }
    }
}

public sealed class GatewayAuthenticationException(string message) : InvalidOperationException(message);
