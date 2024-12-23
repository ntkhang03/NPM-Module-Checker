## v1.0.4
### 🚀 Features
- Added `debounce` to prevent calling `checkDocument` and `checkDocumentAllTabs` functions repeatedly.
- Added setting `npmModuleChecker.delayTimeForCheckDocumentAllTabsCall`: Delay in milliseconds before checking all open tabs when a document is opened or changed.
- Added setting `npmModuleChecker.delayForCheckDocumentCall`: Delay in milliseconds before checking a document for missing packages or modules.

## v1.0.3
### 🚀 Features
- Added context menu action **Check for unused packages**: Right-click on a folder or file in the Explorer view to check for packages that are installed in the project but not used.
- Added setting for enable or disable automatic checking for unused packages when opening `package.json` file.
- Added setting set the severity level for the diagnostic when unused packages are found.

## v1.0.2
### 🚀 Features
- Replace hardcoded default severity values with `config.inspect(...).defaultValue` for better maintainability.

## v1.0.1
### 🚀 Features
- Standardize severity level capitalization (`error` -> `Error`, `warning` -> `Warning`, `info` -> `Info`)

## v1.0.0
### 🚀 Features
- Detect missing **npm packages** and **modules/files** in your project.
- Provide quick fixes to **install missing packages** or **create missing modules/files**.
- **Scan entire** folders or projects for missing packages and modules/files.
- **Log detailed information** about issues found and actions taken.
- Customizable **ignore list** for **packages** and **modules/files**.
- Customizable **ignore list** for **folders** and **files** to scan (**supports regex** patterns).
- And more settings to **customize** the extension to your needs.