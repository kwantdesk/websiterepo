namespace KwantDesk.MarketData.Gateway;

public readonly record struct SseMessage(string Event, string Data);
