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
    public bool IsFuture { get; set; }

    // Historical bar values (collapsed to zero-height for future points)
    public double CreditLow { get; set; }
    public double CreditHigh { get; set; }
    public double DebitHigh { get; set; }
    public double DebitLow { get; set; }

    // Future bar values (collapsed to zero-height for historical points)
    public double FutureCreditLow { get; set; }
    public double FutureCreditHigh { get; set; }
    public double FutureDebitHigh { get; set; }
    public double FutureDebitLow { get; set; }

    // Balance values — separate paths for historical vs future line series
    public double Balance { get; set; }
    public double HistBalance { get; set; }
    public double FutureBalance { get; set; }

    /// <summary>
    /// Creates a historical chart point. Future bar properties are collapsed.
    /// </summary>
    public static BalanceChartPoint Historical(string label, double balance,
        double creditLow, double creditHigh, double debitHigh, double debitLow)
    {
        return new BalanceChartPoint
        {
            Label = label, Balance = balance, IsFuture = false,
            HistBalance = balance, FutureBalance = double.NaN,
            CreditLow = creditLow, CreditHigh = creditHigh,
            DebitHigh = debitHigh, DebitLow = debitLow,
            // Collapsed future bars
            FutureCreditLow = balance, FutureCreditHigh = balance,
            FutureDebitHigh = balance, FutureDebitLow = balance,
        };
    }

    /// <summary>
    /// Creates a future chart point. Historical bar properties are collapsed.
    /// </summary>
    public static BalanceChartPoint Future(string label, double balance,
        double creditLow, double creditHigh, double debitHigh, double debitLow)
    {
        return new BalanceChartPoint
        {
            Label = label, Balance = balance, IsFuture = true,
            HistBalance = double.NaN, FutureBalance = balance,
            // Collapsed historical bars
            CreditLow = balance, CreditHigh = balance,
            DebitHigh = balance, DebitLow = balance,
            FutureCreditLow = creditLow, FutureCreditHigh = creditHigh,
            FutureDebitHigh = debitHigh, FutureDebitLow = debitLow,
        };
    }

    /// <summary>
    /// Builds future chart points by bucketing future transactions into weeks.
    /// </summary>
    public static List<BalanceChartPoint> BuildFuturePoints(
        IList<Transaction> futureTransactions, decimal lastBalance)
    {
        if (futureTransactions.Count == 0) return [];

        var cutoff = DateTime.Today.AddMonths(1);
        var weekMap = new SortedDictionary<string, (decimal credits, decimal debits)>();

        foreach (var tx in futureTransactions)
        {
            if (!DateTime.TryParse(tx.TransactionDate, out var txDate) || txDate > cutoff)
                continue;

            var daysUntilSunday = ((int)DayOfWeek.Sunday - (int)txDate.DayOfWeek + 7) % 7;
            var sunday = txDate.AddDays(daysUntilSunday);
            var weekEnd = sunday.ToString("yyyy-MM-dd");

            weekMap.TryGetValue(weekEnd, out var entry);
            var amt = tx.Amount;
            if (tx.Type == "credit")
                entry.credits += amt;
            else
                entry.debits += amt;
            weekMap[weekEnd] = entry;
        }

        if (weekMap.Count == 0) return [];

        var result = new List<BalanceChartPoint>();
        var bal = lastBalance;

        foreach (var (weekEnd, (credits, debits)) in weekMap)
        {
            var prevBal = bal;
            bal += credits - debits;
            var label = DateTime.TryParse(weekEnd, out var d) ? d.ToString("MMM d") : weekEnd;

            result.Add(Future(label, (double)bal,
                (double)prevBal, (double)(prevBal + credits),
                (double)(prevBal + credits), (double)bal));
        }

        return result;
    }
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
