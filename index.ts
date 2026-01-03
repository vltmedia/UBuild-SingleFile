import esbuild from 'esbuild';
import fs from 'fs';
import  path from 'path';
import { parseArgs } from "util";

interface PackageJson {
    name?: string;
}

interface BuildResult {
    js: string;
    html: string;
    standalone: string;
}

interface Args {
    htmlfile?: string;
    output?: string;
    namespace?: string;
    all?: boolean;
}


const { values , positionals } = parseArgs({
  args: Bun.argv,
  options: {
    htmlfile: {
      type: "string",
    },
    output: {
      type: "string",
    },
    namespace: {
      type: "string",
    },
    all: {
      type: "boolean",
    },
  },
  strict: true,
  allowPositionals: true,
});

/**
 * Build system for SquareSpace
 * Bundles ES modules and inline scripts into a single minified JS file
 * Generates unique IDs and classes to avoid conflicts with SquareSpace
 *
 * The namespace prefix is generated from package.json 'name' field.
 * Change the package name to customize the prefix for all generated classes and IDs.
 */

// Read namespace from package.json
// Use the package name as namespace, ensuring it ends with a dash
let NAMESPACE: string;
try{
NAMESPACE = values.namespace as string; 
}catch(e){
   console.error('Error reading namespace from arguments, REQUIRES a namespace argument like "this-studio-"');
    process.exit(1);
}

/**
 * Transforms HTML content to add unique namespace to IDs and classes
 * Also adds unique classes to global HTML tags
 */
function transformHTML(htmlContent: string): string {
    let transformed: string = htmlContent;

    // Transform id attributes: id="example" -> id="uai-studio-example"
    transformed = transformed.replace(/id=["']([^"']+)["']/g, (match: string, id: string) => {
        if (id.startsWith(NAMESPACE)) return match; // Already prefixed
        return `id="${NAMESPACE}${id}"`;
    });

    // Transform class attributes: class="example other" -> class="uai-studio-example uai-studio-other"
    transformed = transformed.replace(/class=["']([^"']+)["']/g, (match: string, classes: string) => {
        const uniqueClasses = classes.split(/\s+/).map((cls: string) => {
            if (!cls || cls.startsWith(NAMESPACE)) return cls;
            return `${NAMESPACE}${cls}`;
        }).join(' ');
        return `class="${uniqueClasses}"`;
    });

    // Add unique classes to global HTML tags that don't have a class attribute
    // This ensures CSS targeting these tags will work with our namespaced selectors
    const globalTags: string[] = ['body', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'span', 'div',
                        'table', 'thead', 'tbody', 'tr', 'td', 'th', 'button', 'input',
                        'form', 'label', 'ul', 'ol', 'li'];

    globalTags.forEach((tag: string) => {
        // Add class to tags that don't have one: <body> -> <body class="uai-studio-body">
        const noClassRegex = new RegExp(`<${tag}(?![^>]*class=)([^>]*)>`, 'gi');
        transformed = transformed.replace(noClassRegex, (match: string, attrs: string) => {
            return `<${tag}${attrs} class="${NAMESPACE}${tag}">`;
        });

        // Add to existing class attributes: <body class="foo"> -> <body class="uai-studio-body uai-studio-foo">
        const withClassRegex = new RegExp(`<${tag}([^>]*?)class=["']([^"']*?)["']`, 'gi');
        transformed = transformed.replace(withClassRegex, (match: string, beforeClass: string, existingClasses: string) => {
            // Check if the tag class is already in the list
            const classes = existingClasses.split(/\s+/);
            const tagClass = `${NAMESPACE}${tag}`;
            if (!classes.includes(tagClass) && !classes.some(c => c.startsWith(NAMESPACE))) {
                return `<${tag}${beforeClass}class="${tagClass} ${existingClasses}"`;
            }
            return match;
        });
    });

    return transformed;
}

/**
 * Transforms CSS content to add unique namespace to class selectors
 * Also converts global HTML tag selectors to unique classes
 */
function transformCSS(cssContent: string): string {
    let transformed: string = cssContent;

    // List of HTML tags that should be converted to unique classes
    const globalTags: string[] = ['body', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'span', 'div',
                        'table', 'thead', 'tbody', 'tr', 'td', 'th', 'button', 'input',
                        'form', 'label', 'ul', 'ol', 'li'];

    // Convert global HTML tag selectors to unique class selectors
    // Match tag selectors at start of selector or after whitespace/comma
    globalTags.forEach(tag => {
        // Match standalone tag selectors: body { -> .uai-studio-body {
        const standaloneRegex = new RegExp(`(^|[,\\s])${tag}\\s*([{:,])`, 'gm');
        transformed = transformed.replace(standaloneRegex, `$1.${NAMESPACE}${tag}$2`);

        // Match tag selectors with pseudo-classes: body:hover -> .uai-studio-body:hover
        const pseudoRegex = new RegExp(`(^|[,\\s])${tag}(::?[a-z-]+)`, 'gm');
        transformed = transformed.replace(pseudoRegex, `$1.${NAMESPACE}${tag}$2`);
    });

    // Transform class selectors: .example -> .uai-studio-example
    transformed = transformed.replace(/\.([a-zA-Z][\w-]*)/g, (match: string, className: string) => {
        if (className.startsWith(NAMESPACE.replace(/^\./, ''))) return match; // Already prefixed
        return `.${NAMESPACE}${className}`;
    });

    return transformed;
}

/**
 * Transforms JavaScript content to update getElementById and querySelector calls
 */
function transformJavaScript(jsContent: string): string {
    let transformed: string = jsContent;

    // Transform getElementById calls: getElementById('example') -> getElementById('uai-studio-example')
    transformed = transformed.replace(/getElementById\s*\(\s*["']([^"']+)["']\s*\)/g, (match: string, id: string) => {
        if (id.startsWith(NAMESPACE)) return match;
        return `getElementById('${NAMESPACE}${id}')`;
    });

    // Transform querySelector with IDs: querySelector('#example') -> querySelector('#uai-studio-example')
    transformed = transformed.replace(/querySelector\s*\(\s*["']#([^"'\s]+)["']\s*\)/g, (match: string, id: string) => {
        if (id.startsWith(NAMESPACE)) return match;
        return `querySelector('#${NAMESPACE}${id}')`;
    });

    // Transform querySelectorAll with IDs
    transformed = transformed.replace(/querySelectorAll\s*\(\s*["']#([^"'\s]+)["']\s*\)/g, (match: string, id: string) => {
        if (id.startsWith(NAMESPACE)) return match;
        return `querySelectorAll('#${NAMESPACE}${id}')`;
    });

    // Transform querySelector with classes: querySelector('.example') -> querySelector('.uai-studio-example')
    transformed = transformed.replace(/querySelector(All)?\s*\(\s*["']\.([^"'\s.]+)["']\s*\)/g, (match: string, all: string, className: string) => {
        if (className.startsWith(NAMESPACE)) return match;
        const method = all ? 'querySelectorAll' : 'querySelector';
        return `${method}('.${NAMESPACE}${className}')`;
    });

    // Transform classList operations: classList.add('example') -> classList.add('uai-studio-example')
    transformed = transformed.replace(/classList\.(add|remove|toggle|contains)\s*\(\s*["']([^"']+)["']\s*\)/g, (match: string, method: string, className: string) => {
        if (className.startsWith(NAMESPACE)) return match;
        return `classList.${method}('${NAMESPACE}${className}')`;
    });

    return transformed;
}

async function buildPage(htmlPath: string): Promise<BuildResult> {
    const htmlContent: string = fs.readFileSync(htmlPath, 'utf-8');
    const pageDir: string = path.dirname(htmlPath);
    const pageName: string = path.basename(pageDir);
    const outputDir: string = values.output as string;
    const tempEntryPath: string = path.join(outputDir, 'temp-entry.js');
    const outputJsPath: string = path.join(outputDir, 'bundle.js');
    const outputHtmlPath: string = path.join(outputDir, 'index.html');

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`\n📦 Building ${pageName}...`);

    // Extract module imports
    const moduleImports: string[] = [];
    const moduleScriptRegex = /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*><\/script>/g;
    let match;
    while ((match = moduleScriptRegex.exec(htmlContent)) !== null) {
        const moduleSrc: string | undefined = match[1];
        if (!moduleSrc) continue;
        const modulePath = path.join(pageDir, moduleSrc);
        moduleImports.push(modulePath);
        console.log(`  📄 Found module: ${match[1]}`);
    }

    // Extract inline module scripts
    const inlineModuleScripts: string[] = [];
    const inlineModuleRegex = /<script[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/g;
    while ((match = inlineModuleRegex.exec(htmlContent)) !== null) {
        if (!match[0].includes('src=')) { // Only get inline scripts, not external
            const inlineContent = match[1];
            if (!inlineContent) continue;
            const scriptContent = transformJavaScript(inlineContent.trim());
            inlineModuleScripts.push(scriptContent);
            console.log(`  📝 Found inline module script (${inlineContent.trim().split('\n').length} lines)`);
        }
    }

    // Extract regular inline scripts (non-module)
    const inlineScripts: string[] = [];
    const inlineScriptRegex = /<script(?![^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/g;
    while ((match = inlineScriptRegex.exec(htmlContent)) !== null) {
        const [fullMatch = '', scriptBody = ''] = match;
        if (!fullMatch.includes('src=') && scriptBody.trim()) { // Only get inline scripts with content
            const trimmedBody = scriptBody.trim();
            const scriptContent = transformJavaScript(trimmedBody);
            inlineScripts.push(scriptContent);
            console.log(`  📝 Found inline script (${trimmedBody.split('\n').length} lines)`);
        }
    }

    // Create a temporary entry file that combines everything
    let entryContent = '';

    // Import external modules first
    if (moduleImports.length > 0) {
        moduleImports.forEach((modulePath: string) => {
            // Use absolute path for imports to ensure esbuild can resolve them
            const absolutePath = path.resolve(modulePath).replace(/\\/g, '/');
            entryContent += `export * from '${absolutePath}';\n`;
        });
        entryContent += '\n';
    }

    // Process inline module scripts to convert imports to absolute paths
    if (inlineModuleScripts.length > 0) {
        entryContent += '// Inline module scripts\n';
        inlineModuleScripts.forEach((script: string) => {
            // Convert relative imports to absolute paths
            const processedScript = script.replace(
                /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"](.+?)['"]/g,
                (match: string, importPath: string) => {
                    if (importPath.startsWith('.')) {
                        const absolutePath = path.resolve(pageDir, importPath).replace(/\\/g, '/');
                        return match.replace(importPath, absolutePath);
                    }
                    return match;
                }
            );
            entryContent += processedScript + '\n\n';
        });
    }

    // Wrap regular inline scripts in an IIFE to ensure they run after DOM is ready
    if (inlineScripts.length > 0) {
        entryContent += '// Regular inline scripts (wrapped to run after modules)\n';
        entryContent += '(function() {\n';
        entryContent += inlineScripts.join('\n\n');
        entryContent += '\n})();\n';
    }

    // Write temporary entry file
    fs.writeFileSync(tempEntryPath, entryContent);
    console.log(`  ✅ Created temp entry file`);

    // Bundle and minify with esbuild
    try {
        await esbuild.build({
            entryPoints: [tempEntryPath],
            bundle: true,
            minify: true,
            outfile: outputJsPath,
            format: 'iife', // Immediately Invoked Function Expression - works in browsers
            platform: 'browser',
            target: 'es2022', // Updated to es2022 to support top-level await
            sourcemap: true, // Generate sourcemap for debugging
        });

        console.log(`  ✅ Bundled and minified JavaScript`);

        // Clean up temp file
        fs.unlinkSync(tempEntryPath);

        // Transform HTML with unique IDs and classes
        let transformedHTML: string = transformHTML(htmlContent);

        // Read and transform CSS if it exists
        const cssPath = path.join(pageDir, '../../index.css');
        if (fs.existsSync(cssPath)) {
            const cssContent: string = fs.readFileSync(cssPath, 'utf-8');
            const transformedCSS: string = transformCSS(cssContent);

            // Inline the transformed CSS into the HTML
            transformedHTML = transformedHTML.replace(
                /<link[^>]*rel=["']stylesheet["'][^>]*href=["'][^"']*index\.css["'][^>]*>/g,
                `<style>\n${transformedCSS}\n</style>`
            );
        }

        // Remove script tags and replace with bundled script reference
        transformedHTML = transformedHTML.replace(
            /<script[^>]*type=["']module["'][^>]*>[\s\S]*?<\/script>/g,
            ''
        );
        transformedHTML = transformedHTML.replace(
            /<script[^>]*>[\s\S]*?<\/script>/g,
            ''
        );

        // Add the bundled script at the end of body
        transformedHTML = transformedHTML.replace(
            /<\/body>/i,
            `    <script src="bundle.js"></script>\n</body>`
        );

        // Write the transformed HTML file (with external bundle.js reference)
        fs.writeFileSync(outputHtmlPath, transformedHTML);
        console.log(`  ✅ Generated HTML with unique IDs and classes`);

        // Create standalone HTML with inlined JavaScript
        const outputStandalonePath = path.join(outputDir, 'standalone.html');
        const bundledJs: string = fs.readFileSync(outputJsPath, 'utf-8');

        // Replace the script src with inline script
        const standaloneHTML = transformedHTML.replace(
            /<script src="bundle\.js"><\/script>/,
            `<script>\n${bundledJs}\n</script>`
        );

        fs.writeFileSync(outputStandalonePath, standaloneHTML);
        console.log(`  ✅ Generated standalone HTML with inlined JavaScript`);

        // Get file sizes
        const jsStats = fs.statSync(outputJsPath);
        const htmlStats = fs.statSync(outputHtmlPath);
        const standaloneStats = fs.statSync(outputStandalonePath);
        const jsFileSizeKB: string = (jsStats.size / 1024).toFixed(2);
        const htmlFileSizeKB: string = (htmlStats.size / 1024).toFixed(2);
        const standaloneFileSizeKB: string = (standaloneStats.size / 1024).toFixed(2);

        console.log(`\n✨ Build complete!`);
        console.log(`📦 JavaScript: ${outputJsPath} (${jsFileSizeKB} KB)`);
        console.log(`📄 HTML: ${outputHtmlPath} (${htmlFileSizeKB} KB)`);
        console.log(`📄 Standalone: ${outputStandalonePath} (${standaloneFileSizeKB} KB)`);
        console.log(`\n💡 Usage in SquareSpace:`);
        console.log(`   Option 1 (Recommended - Separate files):`);
        console.log(`     1. Upload bundle.js to SquareSpace as a file`);
        console.log(`     2. Copy the HTML from ${outputHtmlPath}`);
        console.log(`     3. Paste into a SquareSpace Code Block`);
        console.log(`   Option 2 (Single file - Best for Code Blocks):`);
        console.log(`     1. Copy the entire contents of ${outputStandalonePath}`);
        console.log(`     2. Paste directly into a SquareSpace Code Block`);
        console.log(`   Option 3 (Just JavaScript):`);
        console.log(`     1. Copy the contents of ${outputJsPath}`);
        console.log(`     2. Paste into a SquareSpace Code Block`);
        console.log(`     3. Wrap in <script> tags\n`);

        const result: BuildResult = { js: outputJsPath, html: outputHtmlPath, standalone: outputStandalonePath };
        return result;
    } catch (error) {
        console.error('❌ Build failed:', error);
        // Clean up temp file on error
        if (fs.existsSync(tempEntryPath)) {
            fs.unlinkSync(tempEntryPath);
        }
        throw error;
    }
}

// Main execution
async function main(): Promise<void> {

    if (values.all == true) {
        // Build all pages
        console.log('🚀 Building all pages...');
        const pagesDir: string = path.join(__dirname, 'src', 'pages');
        const pages = fs.readdirSync(pagesDir)
            .filter(dir => {
                const htmlPath = path.join(pagesDir, dir, 'index.html');
                return fs.existsSync(htmlPath);
            });

        for (const page of pages) {
            const htmlPath = path.join(pagesDir, page, 'index.html');
            try {
                await buildPage(htmlPath);
            } catch (error) {
                console.error(`Failed to build ${page}:`, error);
            }
        }
    } else {
        // Build specific page
        // Bun starts from index 2 because index 0 is node, index 1 is script name, index 2 is namespace
        
        const htmlArg= values.htmlfile;
        if (!htmlArg) {
            console.error('❌ Missing HTML path argument.');
            process.exit(1);
        }
        const htmlPath = path.resolve(htmlArg);
        if (!fs.existsSync(htmlPath)) {
            console.error(`❌ File not found: ${htmlPath}`);
            process.exit(1);
        }
        await buildPage(htmlPath);
    }
}

main().catch((error: unknown) => {
    console.error('❌ Build error:', error);
    process.exit(1);
});
