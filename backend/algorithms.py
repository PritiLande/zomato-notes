def insertion_sort_by_key(items: list[dict], key: str) -> list[dict]:
    """Sorts a list of dicts in descending order by a numeric key,
    using insertion sort implemented from scratch. No built-in sort used."""
    result = list(items)  # work on a copy
    for i in range(1, len(result)):
        current = result[i]
        j = i - 1
        # Shift elements that are smaller than current[key] to the right
        while j >= 0 and result[j][key] < current[key]:
            result[j + 1] = result[j]
            j -= 1
        result[j + 1] = current
    return result


def binary_search_iterative(sorted_titles: list[str], target: str) -> int:
    """Iterative binary search over an alphabetically sorted list of titles.
    Returns the index of target, or -1 if not found."""
    start = 0
    end = len(sorted_titles) - 1
    while start <= end:
        mid = start + (end - start) // 2
        if sorted_titles[mid] == target:
            return mid
        elif sorted_titles[mid] < target:
            start = mid + 1
        else:
            end = mid - 1
    return -1


def binary_search_recursive(sorted_titles: list[str], target: str, start: int, end: int) -> int:
    """Recursive binary search over an alphabetically sorted list of titles.
    Returns the index of target, or -1 if not found."""
    if start > end:
        return -1
    mid = start + (end - start) // 2
    if sorted_titles[mid] == target:
        return mid
    elif sorted_titles[mid] < target:
        return binary_search_recursive(sorted_titles, target, mid + 1, end)
    else:
        return binary_search_recursive(sorted_titles, target, start, mid - 1)


def linear_search(items: list[dict], key: str, value):
    """Scans a list sequentially using an explicit found-flag pattern.
    Returns the first matching dict, or None if no match exists."""
    found = False
    result = None
    for item in items:
        if item.get(key) == value:
            found = True
            result = item
            break
    if found:
        return result
    return None