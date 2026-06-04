using Microsoft.AspNetCore.SignalR;

namespace orchestrator.Hubs;

public interface IConvertClient
{
    Task ProgressUpdated(string sessionId, int percent, string stage);
    Task ConversionCompleted(string sessionId, string outputFile);
    Task ConversionFailed(string sessionId, string error);
}

public class ConvertHub : Hub<IConvertClient>
{
    public async Task JoinSession(string sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
    }

    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
    }
}
