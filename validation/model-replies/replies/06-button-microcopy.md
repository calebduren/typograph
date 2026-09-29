# Microcopy for a save/discard dialog

Dialogs that ask "Do you want to save?" are one of the most common places where button labels go wrong. The fix is to make each label say exactly what will happen.

## Problem

The classic pattern uses "Yes", "No", and "Cancel", which forces the user to re-read the question to decode the buttons. A better pattern names the outcomes.

## Recommended labels

| Situation       | Primary      | Secondary    | Tertiary       |
| --------------- | ------------ | ------------ | -------------- |
| Unsaved edits   | "Save"       | "Don't save" | "Keep editing" |
| Deleting a file | "Delete"     | "Cancel"     |                |
| Leaving a form  | "Leave page" | "Stay"       |                |

Notice that the primary button is a verb, and the destructive option is spelled out. "Don't save" is unambiguous in a way that "No" never is.

## Rules that hold up

1. Use verbs, not "OK".
2. Put the safest action in the most prominent position.
3. Match the button to the title. If the title says "Discard changes?", the button says "Discard".
4. Keep every label to three words or fewer.

## Writing the body text

Keep it plain and specific:

> You've made changes to "Q3 budget.xlsx" that haven't been saved.

That sentence tells the user which file and what's at stake. Avoid scare words such as "Warning!" and avoid blaming: "You didn't save your work" reads as an accusation, while "Your changes haven't been saved" reads as information.

## Testing it

Read the dialog aloud without looking at the buttons. If someone can predict what "Save" will do from the sentence alone, the copy is working. Then test the opposite: cover the sentence, and see if the buttons make sense on their own. People often tap a button without reading the text, so the labels should still be safe.

### The "Cancel" trap

"Cancel" is ambiguous in a save dialog: does it cancel the save, or cancel the close? Use "Keep editing" instead, because it describes where the user ends up.

I can rewrite the text for the specific dialogs in your app if you send me the current screenshots or strings.
