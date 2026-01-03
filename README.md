# UBuild-SingleFile

A tool for bundling HTML, JavaScript, and CSS into a single self-contained HTML file with unique namespace prefixes to avoid conflicts in SquareSpace environments.

## Features

- **Single File Output**: Combines all assets (HTML, JS, CSS) into one standalone HTML file
- **Namespace Prefixing**:
  - Adds unique prefix to IDs (`id="example"` → `id="namespace-example"`)
  - Adds unique prefix to classes (`class="example"` → `class="namespace-example"`)
  - Converts tag selectors to namespaced classes (`body` → `.namespace-body`)
- **Bundling**:
  - Combines ES modules and inline scripts
  - Minifies JavaScript output
  - Inlines CSS directly into the HTML
- **SquareSpace Compatibility**:
  - Avoids conflicts with SquareSpace's built-in styles
  - Ready for direct pasting into Code Blocks

## Install

### Linux
```bash
curl -L https://github.com/vltmedia/UBuild-SingleFile/releases/download/v1.0.1/ubuild-singlefile-v1.0.1-linux-x64.zip -o /tmp/ubuild.zip && sudo unzip -o /tmp/ubuild.zip -d /usr/local/bin

```
### Mac OSX
```bash
curl -L https://github.com/vltmedia/UBuild-SingleFile/releases/download/v1.0.1/ubuild-singlefile-v1.0.1-macos-x64.zip -o /tmp/ubuild.zip && sudo unzip -o /tmp/ubuild.zip -d /usr/local/bin

```
### Mac OSX (M Chips)
```bash
curl -L https://github.com/vltmedia/UBuild-SingleFile/releases/download/v1.0.1/ubuild-singlefile-v1.0.1-windows-x64.zip -o /tmp/ubuild.zip && sudo unzip -o /tmp/ubuild.zip -d /usr/local/bin
```
### Windows
Make sure to run PowerShell as Administrator, then run:
```powershell
iwr https://github.com/vltmedia/UBuild-SingleFile/releases/download/v1.0.1/ubuild-singlefile-v1.0.1-windows-x64.zip -OutFile $env:TEMP\ubuild.zip; Expand-Archive $env:TEMP\ubuild.zip $env:TEMP\ubuild -Force; Move-Item $env:TEMP\ubuild\ubuild-singlefile.exe C:\Windows\System32\ubuild-singlefile.exe -Force
```

## Usage

### 1. Install Dependencies
You need [Bun](https://bun.sh/) to run this tool.
```bash
bun install
```

### 2. Build Command

Build a single HTML file with all assets bundled:

#### Linux
```bash
bun run build-linux
```
#### macOS
```bash
bun run build-macos
```
#### macOS (M Chips)
```bash
bun run build-macos-mchip
```
#### Windows
```bash
bun run build-windows
```

### 3. Usage
After building, you can use the generated `ubuild-singlefile` app as follows:

```bash
ubuild-singlefile --htmlfile <input.html> [--output <./dist/output>] --namespace <prefix>
```

**Arguments:**
| Argument      | Description                                                                 | Required |
|---------------|-----------------------------------------------------------------------------|----------|
| `--htmlfile`  | Path to input HTML file                                                    | Yes      |
| `--output`    | Output directory for standalone HTM            | Yes       |
| `--namespace` | Namespace prefix for all generated IDs and classes                         | Yes      |
| `--all`       | Build all pages in the `src/pages/` directory    

**Examples:**
```bash
# Basic usage with namespace only
ubuild-singlefile --namespace my-project-

# With custom input/output paths
ubuild-singlefile --htmlfile index.html --output output --namespace studio-

# Build all pages (requires --all flag)
ubuild-singlefile --all --namespace my-project-
```

### 4. SquareSpace Integration

1. Copy the entire contents of the generated `standalone.html`
2. Paste directly into any SquareSpace Code Block

## Technical Details

- Uses **esbuild** for fast JavaScript bundling and minification
- Handles both external module imports and inline scripts
- Inlines CSS while preserving original stylesheet structure
- Generates unique class/ID names to prevent style conflicts

# License	
MIT License