namespace HouseRules.Models;

public class Kid
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#512BD4";
    public string Avatar { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public decimal Balance { get; set; }
    public List<RecurringTransaction>? Recurring { get; set; }
    public List<SavingsGoal>? Goals { get; set; }
    public int? PendingCount { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

public class KidUser
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int KidId { get; set; }
    public string? KidName { get; set; }
}
