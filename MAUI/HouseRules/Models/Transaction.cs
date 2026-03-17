using System.Text.Json.Serialization;

namespace HouseRules.Models;

[JsonConverter(typeof(JsonStringEnumConverter<TransactionStatus>))]
public enum TransactionStatus
{
    [JsonStringEnumMemberName("future")]
    Future,
    [JsonStringEnumMemberName("pending")]
    Pending,
    [JsonStringEnumMemberName("requested")]
    Requested,
    [JsonStringEnumMemberName("verified")]
    Verified,
    [JsonStringEnumMemberName("cancelled")]
    Cancelled
}

public class Transaction
{
    public int Id { get; set; }
    public int KidId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string TransactionDate { get; set; } = string.Empty;
    public TransactionStatus Status { get; set; }
    public int? RecurringTransactionId { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? KidName { get; set; }
}

public class Pagination
{
    public int Page { get; set; }
    public int PerPage { get; set; }
    public int Total { get; set; }
    public int TotalPages { get; set; }
}
