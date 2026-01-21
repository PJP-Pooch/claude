---
description: Push latest changes to GitHub
---

// turbo-all

1. Check the current git status to see what files have been modified:
   ```
   git status
   ```

2. Validate the code by running a build:
   ```
   npm run build
   ```
   (If the build fails, fix the errors before proceeding)

3. Stage all modified files:
   ```
   git add .
   ```

4. Commit the changes with a descriptive message (update the message based on what was changed):
   ```
   git commit -m "Update: [describe the changes made]"
   ```

5. Push the changes to the remote repository:
   ```
   git push
   ```

**Note:** The commit message in step 4 should be customized based on the actual changes made. Common patterns:
- `"Fix: [description]"` - for bug fixes
- `"Add: [description]"` - for new features
- `"Update: [description]"` - for modifications
- `"Refactor: [description]"` - for code improvements
- `"Remove: [description]"` - for deletions