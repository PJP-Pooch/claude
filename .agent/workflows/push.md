---
description: Push latest changes to GitHub
---

// turbo-all

1. Check the current git status to see what files have been modified:
   ```
   git status
   ```

2. Stage all modified files:
   ```
   git add .
   ```

3. Commit the changes with a descriptive message (update the message based on what was changed):
   ```
   git commit -m "Update: [describe the changes made]"
   ```

4. Push the changes to the remote repository:
   ```
   git push
   ```

**Note:** The commit message in step 3 should be customized based on the actual changes made. Common patterns:
- `"Fix: [description]"` - for bug fixes
- `"Add: [description]"` - for new features
- `"Update: [description]"` - for modifications
- `"Refactor: [description]"` - for code improvements
- `"Remove: [description]"` - for deletions
