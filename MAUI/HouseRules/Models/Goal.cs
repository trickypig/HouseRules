namespace HouseRules.Models;

public class SavingsGoal
{
    public int Id { get; set; }
    public int KidId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? TargetAmount { get; set; }
    public decimal CurrentAmount { get; set; }
    public int IsCompleted { get; set; }
    public string? CompletedAt { get; set; }
    public string? WantByDate { get; set; }
    public int SortOrder { get; set; }
}

public class GoalProjection
{
    public int GoalId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? TargetAmount { get; set; }
    public decimal CurrentAmount { get; set; }
    public decimal Remaining { get; set; }
    public string? WantByDate { get; set; }
    public string? ExpectedDate { get; set; }
    public bool OnTrack { get; set; }
    public decimal Shortfall { get; set; }
    public int SortOrder { get; set; }
}
