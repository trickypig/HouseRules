namespace HouseRules.Models;

public class RecurringTransaction
{
    public int Id { get; set; }
    public int KidId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public int? DayOfWeek { get; set; }
    public int? DayOfMonth { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string? EndDate { get; set; }
    public int IsActive { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;

    // Computed display properties
    public string AmountDisplay =>
        (Type == "credit" ? "+" : "-") + Amount.ToString("C2");

    public bool IsPaused => IsActive != 1;

    public string ToggleIcon => IsActive == 1 ? "\u23F8" : "\u25B6";

    public string StartDateDisplay =>
        DateTime.TryParse(StartDate, out var d) ? $"Started {d:MMM d, yyyy}" : "";

    private static readonly string[] DayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    public string ScheduleDisplay
    {
        get
        {
            var parts = new List<string>();
            if (!string.IsNullOrEmpty(Frequency)) parts.Add(char.ToUpper(Frequency[0]) + Frequency[1..]);
            if (DayOfWeek is >= 0 and <= 6) parts.Add($"on {DayNames[DayOfWeek.Value]}s");
            if (DayOfMonth != null) parts.Add($"on day {DayOfMonth}");
            return string.Join(" ", parts);
        }
    }
}
