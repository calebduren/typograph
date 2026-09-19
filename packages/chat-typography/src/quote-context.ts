// Shared by the text transform and the independent hanging helper.
export const elisions = ['em', 'twas', 'tis', 'cause', 'bout', 'round', 'til', 'n'];
// The object replacement character stands in for inline nodes such as footnotes.
export const openingContext = /[\s([{—–"'“‘\ufffc]/u;
export const closingContext = /[\s)\]},.!?;:—–"'”’\ufffc]/u;
