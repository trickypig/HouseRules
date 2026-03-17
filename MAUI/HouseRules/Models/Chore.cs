namespace HouseRules.Models;

public class ChoreTemplate
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public string? Frequency { get; set; }
    public int? DayOfWeek { get; set; }
    public int? DayOfMonth { get; set; }
    public int? AssignedKidId { get; set; }
    public string? AssignedKidName { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string? EndDate { get; set; }
    public int IsActive { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

public class ChoreInstance
{
    public int Id { get; set; }
    public int? ChoreTemplateId { get; set; }
    public int? KidId { get; set; }
    public int? ClaimedByKidId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public string DueDate { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? CompletedAt { get; set; }
    public string? VerifiedAt { get; set; }
    public int? TransactionId { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? KidName { get; set; }
    public string? ClaimedByName { get; set; }
}
