namespace HouseRules.Models;

public class ShoppingList
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? ItemCount { get; set; }
    public int? UnpurchasedCount { get; set; }
    public List<string>? UnpurchasedItems { get; set; }
    public List<string>? PurchasedItems { get; set; }
    public int SortOrder { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

public class ShoppingListItem
{
    public int Id { get; set; }
    public int ListId { get; set; }
    public string Description { get; set; } = string.Empty;
    public int IsPurchased { get; set; }
    public int AddedByUserId { get; set; }
    public string? AddedByName { get; set; }
    public int IsRequest { get; set; }
    public string Quantity { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string? PurchasedAt { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}
