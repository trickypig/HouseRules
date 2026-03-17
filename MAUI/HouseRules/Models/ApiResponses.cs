namespace HouseRules.Models;

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public User User { get; set; } = new();
}

public class UserResponse
{
    public User User { get; set; } = new();
}

public class HouseholdResponse
{
    public Household Household { get; set; } = new();
    public List<HouseholdMember> Members { get; set; } = [];
}

public class UpdateHouseholdResponse
{
    public Household Household { get; set; } = new();
}

public class InviteCodeResponse
{
    public string InviteCode { get; set; } = string.Empty;
}

public class JoinHouseholdResponse
{
    public string Token { get; set; } = string.Empty;
    public User User { get; set; } = new();
    public Household Household { get; set; } = new();
}

public class KidUserResponse
{
    public KidUser KidUser { get; set; } = new();
}

public class KidUsersResponse
{
    public List<KidUser> KidUsers { get; set; } = [];
}

public class KidsResponse
{
    public List<Kid> Kids { get; set; } = [];
}

public class KidResponse
{
    public Kid Kid { get; set; } = new();
}

public class TransactionsResponse
{
    public List<Transaction> Transactions { get; set; } = [];
    public Dictionary<string, decimal> DateBalances { get; set; } = [];
    public Pagination Pagination { get; set; } = new();
}

public class TransactionResponse
{
    public Transaction Transaction { get; set; } = new();
}

public class VerifyAllResponse
{
    public int Verified { get; set; }
}

public class WeeklySummaryResponse
{
    public List<WeekSummary> Weeks { get; set; } = [];
}

public class WeekSummary
{
    public string WeekEnd { get; set; } = string.Empty;
    public decimal Credits { get; set; }
    public decimal Debits { get; set; }
    public decimal Balance { get; set; }

    // Short date label for chart x-axis (e.g. "Mar 17")
    public string WeekEndShort =>
        DateTime.TryParse(WeekEnd, out var d) ? d.ToString("MMM d") : WeekEnd;
}

public class BalanceChartPoint
{
    public string Label { get; set; } = string.Empty;
    public double Balance { get; set; }
    public double CreditLow { get; set; }
    public double CreditHigh { get; set; }
    public double DebitHigh { get; set; }
    public double DebitLow { get; set; }
}

public class RecurringListResponse
{
    public List<RecurringTransaction> Recurring { get; set; } = [];
}

public class RecurringResponse
{
    public RecurringTransaction Recurring { get; set; } = new();
}

public class GoalsResponse
{
    public List<SavingsGoal> Goals { get; set; } = [];
}

public class GoalResponse
{
    public SavingsGoal Goal { get; set; } = new();
}

public class GoalProjectionsResponse
{
    public List<GoalProjection> Projections { get; set; } = [];
}

public class DashboardResponse
{
    public List<Kid> Kids { get; set; } = [];
    public List<Transaction> RecentTransactions { get; set; } = [];
    public List<Transaction> PendingTransactions { get; set; } = [];
    public List<ChoreInstance> OverdueChores { get; set; } = [];
    public List<ChoreInstance> CompletedChores { get; set; } = [];
    public List<ShoppingList> ShoppingLists { get; set; } = [];
}

public class KidDashboardResponse
{
    public Kid Kid { get; set; } = new();
    public List<RecurringTransaction> Recurring { get; set; } = [];
    public List<SavingsGoal> Goals { get; set; } = [];
    public List<Transaction> Transactions { get; set; } = [];
    public Dictionary<string, decimal> DateBalances { get; set; } = [];
    public Pagination Pagination { get; set; } = new();
}

public class ChoreBoardResponse
{
    public List<ChoreTemplate> Templates { get; set; } = [];
    public List<ChoreInstance> Instances { get; set; } = [];
}

public class ChoreTemplateResponse
{
    public ChoreTemplate Template { get; set; } = new();
}

public class ChoreInstancesResponse
{
    public List<ChoreInstance> Instances { get; set; } = [];
}

public class ChoreInstanceResponse
{
    public ChoreInstance Instance { get; set; } = new();
    public int? TransactionId { get; set; }
}

public class MyChoresResponse
{
    public List<ChoreInstance> MyChores { get; set; } = [];
    public List<ChoreInstance> OpenChores { get; set; } = [];
}

public class ShoppingListsResponse
{
    public List<ShoppingList> Lists { get; set; } = [];
}

public class ShoppingListResponse
{
    public ShoppingList List { get; set; } = new();
}

public class ShoppingItemsResponse
{
    public List<ShoppingListItem> Items { get; set; } = [];
    public ShoppingList List { get; set; } = new();
}

public class ShoppingItemResponse
{
    public ShoppingListItem Item { get; set; } = new();
}

public class AutocompleteResponse
{
    public List<string> Suggestions { get; set; } = [];
}
