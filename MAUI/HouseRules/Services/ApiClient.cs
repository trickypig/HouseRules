using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using HouseRules.Models;

namespace HouseRules.Services;

public class ApiClient
{
    private readonly HttpClient _http;
    private readonly AuthService _auth;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    public ApiClient(HttpClient http, AuthService auth)
    {
        _http = http;
        _http.BaseAddress = new Uri("https://house.trickypig.com");
        _auth = auth;
    }

    private async Task<T> RequestAsync<T>(HttpMethod method, string path, object? body = null)
    {
        using var request = new HttpRequestMessage(method, $"/api{path}");

        if (_auth.Token is not null)
        {
            request.Headers.Add("Authorization", $"Bearer {_auth.Token}");
            request.Headers.Add("X-Auth-Token", _auth.Token);
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body, options: JsonOptions);
        }

        var response = await _http.SendAsync(request);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            await _auth.LogoutAsync();
            throw new UnauthorizedAccessException("Session expired");
        }

        if (!response.IsSuccessStatusCode)
        {
            var errorText = await response.Content.ReadAsStringAsync();
            string message;
            try
            {
                using var doc = JsonDocument.Parse(errorText);
                message = doc.RootElement.TryGetProperty("message", out var msg) ? msg.GetString() ?? "Request failed"
                    : doc.RootElement.TryGetProperty("error", out var err) ? err.GetString() ?? "Request failed"
                    : $"Request failed with status {(int)response.StatusCode}";
            }
            catch
            {
                message = $"Request failed with status {(int)response.StatusCode}";
            }
            throw new ApiException(message, (int)response.StatusCode);
        }

        if (response.StatusCode == System.Net.HttpStatusCode.NoContent)
        {
            return default!;
        }

        return (await response.Content.ReadFromJsonAsync<T>(JsonOptions))!;
    }

    private Task<T> GetAsync<T>(string path) => RequestAsync<T>(HttpMethod.Get, path);
    private Task<T> PostAsync<T>(string path, object? body = null) => RequestAsync<T>(HttpMethod.Post, path, body);
    private Task<T> PutAsync<T>(string path, object? body = null) => RequestAsync<T>(HttpMethod.Put, path, body);
    private Task<T> DeleteAsync<T>(string path) => RequestAsync<T>(HttpMethod.Delete, path);

    // Auth
    public Task<LoginResponse> LoginAsync(string email, string password) =>
        PostAsync<LoginResponse>("/auth/login", new { email, password });

    public Task<LoginResponse> RegisterAsync(string email, string password, string displayName) =>
        PostAsync<LoginResponse>("/auth/register", new { email, password, display_name = displayName });

    public Task<UserResponse> GetMeAsync() =>
        GetAsync<UserResponse>("/auth/me");

    public Task<UserResponse> UpdateProfileAsync(string? displayName = null, string? familyDisplayName = null) =>
        PutAsync<UserResponse>("/auth/profile", new { display_name = displayName, family_display_name = familyDisplayName });

    // Household
    public Task<HouseholdResponse> GetHouseholdAsync() =>
        GetAsync<HouseholdResponse>("/household");

    public Task<UpdateHouseholdResponse> UpdateHouseholdAsync(string name) =>
        PutAsync<UpdateHouseholdResponse>("/household", new { name });

    public Task<InviteCodeResponse> RegenerateInviteCodeAsync() =>
        PostAsync<InviteCodeResponse>("/household/regenerate-code");

    public Task<JoinHouseholdResponse> JoinHouseholdAsync(string inviteCode) =>
        PostAsync<JoinHouseholdResponse>("/household/join", new { invite_code = inviteCode });

    // Kid Logins
    public Task<KidUserResponse> CreateKidLoginAsync(int kidId, string email, string password, string? displayName = null) =>
        PostAsync<KidUserResponse>("/auth/kid-login", new { kid_id = kidId, email, password, display_name = displayName });

    public Task<KidUsersResponse> GetKidUsersAsync() =>
        GetAsync<KidUsersResponse>("/auth/kid-users");

    public Task<KidUserResponse> UpdateKidLoginAsync(int id, string? password = null, string? displayName = null) =>
        PutAsync<KidUserResponse>($"/auth/kid-login/{id}", new { password, display_name = displayName });

    public Task DeleteKidLoginAsync(int id) =>
        DeleteAsync<object>($"/auth/kid-login/{id}");

    // Kids
    public Task<KidsResponse> GetKidsAsync() =>
        GetAsync<KidsResponse>("/kids");

    public Task<KidResponse> CreateKidAsync(string name, string? color = null, string? avatar = null) =>
        PostAsync<KidResponse>("/kids", new { name, color, avatar });

    public Task<KidResponse> GetKidAsync(int id) =>
        GetAsync<KidResponse>($"/kids/{id}");

    public Task<KidResponse> UpdateKidAsync(int id, string? name = null, string? color = null, string? avatar = null) =>
        PutAsync<KidResponse>($"/kids/{id}", new { name, color, avatar });

    public Task DeleteKidAsync(int id) =>
        DeleteAsync<object>($"/kids/{id}");

    // Transactions
    public Task<TransactionsResponse> GetTransactionsAsync(int kidId, string? type = null, string? category = null,
        string? status = null, string? from = null, string? to = null, int? page = null, int? perPage = null)
    {
        var query = new List<string>();
        if (type is not null) query.Add($"type={Uri.EscapeDataString(type)}");
        if (category is not null) query.Add($"category={Uri.EscapeDataString(category)}");
        if (status is not null) query.Add($"status={Uri.EscapeDataString(status)}");
        if (from is not null) query.Add($"from={Uri.EscapeDataString(from)}");
        if (to is not null) query.Add($"to={Uri.EscapeDataString(to)}");
        if (page is not null) query.Add($"page={page}");
        if (perPage is not null) query.Add($"per_page={perPage}");
        var qs = query.Count > 0 ? "?" + string.Join("&", query) : "";
        return GetAsync<TransactionsResponse>($"/kids/{kidId}/transactions{qs}");
    }

    public Task<WeeklySummaryResponse> GetWeeklySummaryAsync(int kidId, int? weeks = null)
    {
        var qs = weeks.HasValue ? $"?weeks={weeks}" : "";
        return GetAsync<WeeklySummaryResponse>($"/kids/{kidId}/weekly-summary{qs}");
    }

    public Task<TransactionResponse> CreateTransactionAsync(int kidId, string type, decimal amount,
        string? category = null, string? description = null, string? transactionDate = null, string? status = null) =>
        PostAsync<TransactionResponse>($"/kids/{kidId}/transactions", new
        {
            type, category, amount, description, transaction_date = transactionDate, status
        });

    public Task<TransactionResponse> UpdateTransactionAsync(int id, string? type = null, string? category = null,
        decimal? amount = null, string? description = null, string? transactionDate = null, string? status = null) =>
        PutAsync<TransactionResponse>($"/transactions/{id}", new
        {
            type, category, amount, description, transaction_date = transactionDate, status
        });

    public Task DeleteTransactionAsync(int id) =>
        DeleteAsync<object>($"/transactions/{id}");

    public Task<TransactionResponse> VerifyTransactionAsync(int id) =>
        PostAsync<TransactionResponse>($"/transactions/{id}/verify");

    public Task<TransactionResponse> CancelTransactionAsync(int id) =>
        PostAsync<TransactionResponse>($"/transactions/{id}/cancel");

    public Task<VerifyAllResponse> VerifyAllPendingAsync(int kidId) =>
        PostAsync<VerifyAllResponse>($"/kids/{kidId}/transactions/verify-all");

    // Recurring Transactions
    public Task<RecurringListResponse> GetRecurringAsync(int kidId) =>
        GetAsync<RecurringListResponse>($"/kids/{kidId}/recurring");

    public Task<RecurringResponse> CreateRecurringAsync(int kidId, string type, decimal amount, string frequency,
        string? category = null, string? description = null, int? dayOfWeek = null, int? dayOfMonth = null,
        string? startDate = null, string? endDate = null) =>
        PostAsync<RecurringResponse>($"/kids/{kidId}/recurring", new
        {
            type, category, amount, description, frequency,
            day_of_week = dayOfWeek, day_of_month = dayOfMonth,
            start_date = startDate, end_date = endDate
        });

    public Task<RecurringResponse> UpdateRecurringAsync(int id, string? type = null, string? category = null,
        decimal? amount = null, string? description = null, string? frequency = null,
        int? dayOfWeek = null, int? dayOfMonth = null, string? endDate = null, bool? isActive = null) =>
        PutAsync<RecurringResponse>($"/recurring/{id}", new
        {
            type, category, amount, description, frequency,
            day_of_week = dayOfWeek, day_of_month = dayOfMonth,
            end_date = endDate, is_active = isActive
        });

    public Task DeleteRecurringAsync(int id) =>
        DeleteAsync<object>($"/recurring/{id}");

    // Goals
    public Task<GoalsResponse> GetGoalsAsync(int kidId) =>
        GetAsync<GoalsResponse>($"/kids/{kidId}/goals");

    public Task<GoalResponse> CreateGoalAsync(int kidId, string name, decimal? targetAmount = null, string? wantByDate = null) =>
        PostAsync<GoalResponse>($"/kids/{kidId}/goals", new { name, target_amount = targetAmount, want_by_date = wantByDate });

    public Task<GoalResponse> UpdateGoalAsync(int id, string? name = null, decimal? targetAmount = null, string? wantByDate = null) =>
        PutAsync<GoalResponse>($"/goals/{id}", new { name, target_amount = targetAmount, want_by_date = wantByDate });

    public Task DeleteGoalAsync(int id) =>
        DeleteAsync<object>($"/goals/{id}");

    public Task<GoalsResponse> ReorderGoalsAsync(int kidId, List<int> goalIds) =>
        PutAsync<GoalsResponse>($"/kids/{kidId}/goals/reorder", new { goal_ids = goalIds });

    public Task<GoalProjectionsResponse> GetGoalProjectionsAsync(int kidId) =>
        GetAsync<GoalProjectionsResponse>($"/kids/{kidId}/goals/projections");

    // Dashboard (parent)
    public Task<DashboardResponse> GetDashboardAsync() =>
        GetAsync<DashboardResponse>("/dashboard");

    // Kid Portal
    public Task<KidDashboardResponse> GetMyDashboardAsync() =>
        GetAsync<KidDashboardResponse>("/my/dashboard");

    public Task<TransactionsResponse> GetMyTransactionsAsync(string? type = null, string? category = null,
        string? status = null, string? from = null, string? to = null, int? page = null, int? perPage = null)
    {
        var query = new List<string>();
        if (type is not null) query.Add($"type={Uri.EscapeDataString(type)}");
        if (category is not null) query.Add($"category={Uri.EscapeDataString(category)}");
        if (status is not null) query.Add($"status={Uri.EscapeDataString(status)}");
        if (from is not null) query.Add($"from={Uri.EscapeDataString(from)}");
        if (to is not null) query.Add($"to={Uri.EscapeDataString(to)}");
        if (page is not null) query.Add($"page={page}");
        if (perPage is not null) query.Add($"per_page={perPage}");
        var qs = query.Count > 0 ? "?" + string.Join("&", query) : "";
        return GetAsync<TransactionsResponse>($"/my/transactions{qs}");
    }

    public Task<WeeklySummaryResponse> GetMyWeeklySummaryAsync(int? weeks = null)
    {
        var qs = weeks.HasValue ? $"?weeks={weeks}" : "";
        return GetAsync<WeeklySummaryResponse>($"/my/weekly-summary{qs}");
    }

    public Task<TransactionResponse> RequestMoneyAsync(decimal amount, string description, string? type = null, string? category = null) =>
        PostAsync<TransactionResponse>("/my/request", new { amount, description, type, category });

    // Chores (parent)
    public Task<ChoreBoardResponse> GetChoreBoardAsync() =>
        GetAsync<ChoreBoardResponse>("/chores");

    public Task<ChoreTemplateResponse> CreateChoreAsync(string title, string? description = null, decimal? amount = null,
        string? frequency = null, int? dayOfWeek = null, int? dayOfMonth = null,
        int? assignedKidId = null, string? startDate = null, string? endDate = null) =>
        PostAsync<ChoreTemplateResponse>("/chores", new
        {
            title, description, amount, frequency,
            day_of_week = dayOfWeek, day_of_month = dayOfMonth,
            assigned_kid_id = assignedKidId, start_date = startDate, end_date = endDate
        });

    public Task<ChoreTemplateResponse> UpdateChoreAsync(int id, string? title = null, string? description = null,
        decimal? amount = null, string? frequency = null, int? dayOfWeek = null, int? dayOfMonth = null,
        int? assignedKidId = null, string? startDate = null, string? endDate = null, int? isActive = null) =>
        PutAsync<ChoreTemplateResponse>($"/chores/{id}", new
        {
            title, description, amount, frequency,
            day_of_week = dayOfWeek, day_of_month = dayOfMonth,
            assigned_kid_id = assignedKidId, start_date = startDate, end_date = endDate, is_active = isActive
        });

    public Task DeleteChoreAsync(int id) =>
        DeleteAsync<object>($"/chores/{id}");

    public Task<ChoreInstancesResponse> GetChoreInstancesAsync(string? status = null, int? kidId = null, string? from = null, string? to = null)
    {
        var query = new List<string>();
        if (status is not null) query.Add($"status={Uri.EscapeDataString(status)}");
        if (kidId is not null) query.Add($"kid_id={kidId}");
        if (from is not null) query.Add($"from={Uri.EscapeDataString(from)}");
        if (to is not null) query.Add($"to={Uri.EscapeDataString(to)}");
        var qs = query.Count > 0 ? "?" + string.Join("&", query) : "";
        return GetAsync<ChoreInstancesResponse>($"/chores/instances{qs}");
    }

    public Task<ChoreInstanceResponse> VerifyChoreAsync(int id) =>
        PostAsync<ChoreInstanceResponse>($"/chores/instances/{id}/verify");

    public Task<ChoreInstanceResponse> RejectChoreAsync(int id) =>
        PostAsync<ChoreInstanceResponse>($"/chores/instances/{id}/reject");

    // Chores (kid)
    public Task<MyChoresResponse> GetMyChoresAsync() =>
        GetAsync<MyChoresResponse>("/my/chores");

    public Task<ChoreInstanceResponse> ClaimChoreAsync(int id) =>
        PostAsync<ChoreInstanceResponse>($"/my/chores/{id}/claim");

    public Task<ChoreInstanceResponse> CompleteChoreAsync(int id) =>
        PostAsync<ChoreInstanceResponse>($"/my/chores/{id}/complete");

    // Shopping
    public Task<ShoppingListsResponse> GetShoppingListsAsync() =>
        GetAsync<ShoppingListsResponse>("/shopping/lists");

    public Task<ShoppingListResponse> CreateShoppingListAsync(string name) =>
        PostAsync<ShoppingListResponse>("/shopping/lists", new { name });

    public Task<ShoppingListResponse> UpdateShoppingListAsync(int id, string name) =>
        PutAsync<ShoppingListResponse>($"/shopping/lists/{id}", new { name });

    public Task DeleteShoppingListAsync(int id) =>
        DeleteAsync<object>($"/shopping/lists/{id}");

    public Task<ShoppingItemsResponse> GetShoppingItemsAsync(int listId) =>
        GetAsync<ShoppingItemsResponse>($"/shopping/lists/{listId}/items");

    public Task<ShoppingItemResponse> AddShoppingItemAsync(int listId, string description, string? quantity = null, string? notes = null) =>
        PostAsync<ShoppingItemResponse>($"/shopping/lists/{listId}/items", new { description, quantity, notes });

    public Task<ShoppingItemResponse> UpdateShoppingItemAsync(int id, string? description = null, string? quantity = null, string? notes = null) =>
        PutAsync<ShoppingItemResponse>($"/shopping/items/{id}", new { description, quantity, notes });

    public Task<ShoppingItemResponse> ToggleShoppingItemAsync(int id) =>
        PostAsync<ShoppingItemResponse>($"/shopping/items/{id}/toggle");

    public Task DeleteShoppingItemAsync(int id) =>
        DeleteAsync<object>($"/shopping/items/{id}");

    public Task<AutocompleteResponse> AutocompleteShoppingItemAsync(string query) =>
        GetAsync<AutocompleteResponse>($"/shopping/autocomplete?q={Uri.EscapeDataString(query)}");
}

public class ApiException : Exception
{
    public int StatusCode { get; }
    public ApiException(string message, int statusCode) : base(message)
    {
        StatusCode = statusCode;
    }
}
