#!/usr/bin/env bash

# Don't exit on error - we'll handle errors gracefully
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
# Use SSH URL for authentication, or override with CONTENT_REPO_URL env var
CONTENT_REPO="${CONTENT_REPO_URL:-git@github.com:sky-ecosystem/corpus.git}"
CONTENT_VERSION_FILE=".content-version"
TEMP_DIR=".tmp-content-repo"
OUTPUT_SOURCE_PATH="output/webapp/faq"
DESTINATION_PATH="src/data/faqs"
TOOLTIPS_SOURCE_PATH="output/webapp/tooltips"
TOOLTIPS_DESTINATION_PATH="../../packages/widgets/src/data/tooltips"
BANNERS_SOURCE_PATH="output/webapp/banner"
BANNERS_DESTINATION_PATH="src/data/banners"
EXTRACT_SCRIPT="scripts/extract_webapp_faqs.js"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[SYNC]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if .content-version file exists
if [ ! -f "$CONTENT_VERSION_FILE" ]; then
    print_error "Content version file '$CONTENT_VERSION_FILE' not found!"
    print_error "Please create it with a valid commit hash or tag."
    exit 1
fi

# Read the content version
CONTENT_VERSION=$(cat "$CONTENT_VERSION_FILE" | tr -d '[:space:]')

if [ -z "$CONTENT_VERSION" ]; then
    print_error "Content version file '$CONTENT_VERSION_FILE' is empty!"
    exit 1
fi

print_status "Using content version: $CONTENT_VERSION"

# Clean up any existing temp directory
if [ -d "$TEMP_DIR" ]; then
    print_status "Cleaning up existing temp directory..."
    rm -rf "$TEMP_DIR"
fi

# Clone the repository at the specific version
print_status "Cloning content repository..."
git clone --quiet "$CONTENT_REPO" "$TEMP_DIR" 2>/dev/null

# Check if clone was successful
if [ $? -ne 0 ]; then
    print_warning "Failed to clone content repository. This might be due to:"
    print_warning "  - Missing SSH keys or authentication"
    print_warning "  - Network connectivity issues"
    print_warning "  - Repository access permissions"
    print_warning ""
    print_warning "Skipping content sync. The build will continue with existing content."
    rm -rf "$TEMP_DIR" 2>/dev/null
    exit 0
fi

# Navigate to the temp directory
cd "$TEMP_DIR"

# Checkout the specific version
print_status "Checking out version: $CONTENT_VERSION"
git checkout --quiet "$CONTENT_VERSION" 2>/dev/null

# Check if checkout was successful
if [ $? -ne 0 ]; then
    print_warning "Failed to checkout version: $CONTENT_VERSION"
    print_warning "Skipping content sync. The build will continue with existing content."
    cd ..
    rm -rf "$TEMP_DIR"
    exit 0
fi

# Check if the extract script exists
if [ ! -f "$EXTRACT_SCRIPT" ]; then
    print_error "Extract script '$EXTRACT_SCRIPT' not found in content repository!"
    cd ..
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Run the extract script
# Create a temporary package.json without "type": "module" to run CommonJS scripts
print_status "Running extraction script..."

# Save current package.json if it exists
if [ -f "package.json" ]; then
    mv package.json package.json.bak
fi

# Create a minimal package.json for CommonJS
cat > package.json << 'EOF'
{
  "name": "temp-extraction",
  "version": "1.0.0"
}
EOF

# Run the extraction script
node "$EXTRACT_SCRIPT"
EXTRACT_EXIT_CODE=$?

# Restore original package.json if it existed
if [ -f "package.json.bak" ]; then
    mv package.json.bak package.json
else
    rm package.json
fi

# Check if the extraction script succeeded
if [ $EXTRACT_EXIT_CODE -ne 0 ]; then
    print_error "Extraction script failed!"
    cd ..
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Check if output was generated
if [ ! -d "$OUTPUT_SOURCE_PATH" ]; then
    print_error "Expected output directory '$OUTPUT_SOURCE_PATH' was not created!"
    cd ..
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Go back to project root
cd ..

# Ensure destination directory exists
mkdir -p "$DESTINATION_PATH"

# Copy generated files to destination
print_status "Copying generated files to $DESTINATION_PATH..."

# Use rsync for better control over the copy process
# This will copy all files from output/website/* to app/(main)/faq/
# Without --delete flag, existing files will be preserved
if command -v rsync &> /dev/null; then
    rsync -av "$TEMP_DIR/$OUTPUT_SOURCE_PATH/" "$DESTINATION_PATH/"
else
    # Fallback to cp if rsync is not available
    print_warning "rsync not found, using cp instead"
    cp -r "$TEMP_DIR/$OUTPUT_SOURCE_PATH/"* "$DESTINATION_PATH/"
fi

# Post-process sharedFaqItems.ts and update getBalancesFaqItems.ts
print_status "Processing sharedFaqItems and updating getBalancesFaqItems..."

# Create a Node.js script to extract and combine the FAQ items
cat > "$DESTINATION_PATH/.process-shared-items.cjs" << 'EOF'
const fs = require('fs');
const path = require('path');

// Files to process for sharedFaqItems
const sourceFiles = [
  'getL2GeneralFaqItems.ts',
  'getBaseFaqItems.ts', 
  'getArbitrumFaqItems.ts',
  'getOptimismFaqItems.ts',
  'getUnichainFaqItems.ts'
];

// Export names for each file
const exportNames = {
  'getL2GeneralFaqItems.ts': 'L2GeneralFaqItems',
  'getBaseFaqItems.ts': 'baseFaqItems',
  'getArbitrumFaqItems.ts': 'arbitrumFaqItems',
  'getOptimismFaqItems.ts': 'optimismFaqItems',
  'getUnichainFaqItems.ts': 'unichainFaqItems'
};

// Store L2 FAQ content for later use
let l2SavingsContent = '';
let l2TradeContent = '';

let outputContent = '';

// Process each file for sharedFaqItems
sourceFiles.forEach((fileName) => {
  const filePath = path.join(__dirname, fileName);
  
  if (fs.existsSync(filePath)) {
    console.log(`Processing ${fileName}...`);
    
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract the items array using regex
    const match = content.match(/const items = (\[[\s\S]*?\]);[\s\S]*?return items/);
    
    if (match && match[1]) {
      const itemsArray = match[1];
      const exportName = exportNames[fileName];
      
      // Add export to output
      if (outputContent) outputContent += '\n\n';
      outputContent += `export const ${exportName} = ${itemsArray};`;
      
      // Delete the source file
      fs.unlinkSync(filePath);
      console.log(`  - Extracted and removed ${fileName}`);
    } else {
      console.log(`  - Warning: Could not extract items from ${fileName}`);
    }
  }
});

// Process getL2SavingsFaqItems.ts separately
const l2SavingsFilePath = path.join(__dirname, 'getL2SavingsFaqItems.ts');
if (fs.existsSync(l2SavingsFilePath)) {
  console.log('Processing getL2SavingsFaqItems.ts...');
  
  // Read the file content
  const content = fs.readFileSync(l2SavingsFilePath, 'utf8');
  
  // Extract the items array
  const match = content.match(/const items = (\[[\s\S]*?\]);[\s\S]*?return items/);
  
  if (match && match[1]) {
    l2SavingsContent = match[1];
    console.log('  - Extracted L2SavingsFaqItems content');
    
    // Delete the source file
    fs.unlinkSync(l2SavingsFilePath);
    console.log('  - Removed getL2SavingsFaqItems.ts');
  } else {
    console.log('  - Warning: Could not extract items from getL2SavingsFaqItems.ts');
  }
}

// Process getL2TradeFaqItems.ts separately  
const l2TradeFilePath = path.join(__dirname, 'getL2TradeFaqItems.ts');
if (fs.existsSync(l2TradeFilePath)) {
  console.log('Processing getL2TradeFaqItems.ts...');
  
  // Read the file content
  const content = fs.readFileSync(l2TradeFilePath, 'utf8');
  
  // Extract the items array
  const match = content.match(/const items = (\[[\s\S]*?\]);[\s\S]*?return items/);
  
  if (match && match[1]) {
    l2TradeContent = match[1];
    console.log('  - Extracted L2TradeFaqItems content');
    
    // Delete the source file
    fs.unlinkSync(l2TradeFilePath);
    console.log('  - Removed getL2TradeFaqItems.ts');
  } else {
    console.log('  - Warning: Could not extract items from getL2TradeFaqItems.ts');
  }
}

// Write the combined sharedFaqItems file
if (outputContent) {
  const outputPath = path.join(__dirname, 'sharedFaqItems.ts');
  fs.writeFileSync(outputPath, outputContent + '\n', 'utf8');
  console.log(`Created sharedFaqItems.ts with combined exports`);
} else {
  console.log('No content to write to sharedFaqItems.ts');
}

// Now update getBalancesFaqItems.ts, getSavingsFaqItems.ts and getTradeFaqItems.ts to use chain-aware logic
const balancesFilePath = path.join(__dirname, 'getBalancesFaqItems.ts');
const savingsFilePath = path.join(__dirname, 'getSavingsFaqItems.ts');
const tradeFilePath = path.join(__dirname, 'getTradeFaqItems.ts');

// Update getBalancesFaqItems.ts
if (fs.existsSync(balancesFilePath)) {
  console.log('Updating getBalancesFaqItems.ts with chain-aware logic...');
  
  // Read the current file
  const content = fs.readFileSync(balancesFilePath, 'utf8');
  
  // Extract the items array
  const match = content.match(/const items = (\[[\s\S]*?\]);[\s\S]*?return items/);
  
  if (match && match[1]) {
    // Create the new chain-aware version
    const newContent = `import {
  isArbitrumChainId,
  isBaseChainId,
  isOptimismChainId,
  isUnichainChainId
} from '@jetstreamgg/sky-utils';

import {
  L2GeneralFaqItems,
  arbitrumFaqItems,
  baseFaqItems,
  optimismFaqItems,
  unichainFaqItems
} from './sharedFaqItems';
import { getBundledTransactionsFaqItems } from './getBundledTransactionsFaqItems';
import { deduplicateFaqItems } from './utils';

export const getBalancesFaqItems = (chainId: number) => {
  const items = [
    ...generalFaqItems,
    ...L2GeneralFaqItems,
    ...(isBaseChainId(chainId) ? baseFaqItems : []),
    ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : []),
    ...(isOptimismChainId(chainId) ? optimismFaqItems : []),
    ...(isUnichainChainId(chainId) ? unichainFaqItems : []),
    ...getBundledTransactionsFaqItems()
  ];
  
  return deduplicateFaqItems(items);
};

const generalFaqItems = ${match[1]};
`;
    
    fs.writeFileSync(balancesFilePath, newContent, 'utf8');
    console.log('  - Updated getBalancesFaqItems.ts with chain-aware imports and logic');
  } else {
    console.log('  - Warning: Could not extract items from getBalancesFaqItems.ts');
  }
}

// Update getSavingsFaqItems.ts
if (fs.existsSync(savingsFilePath)) {
  console.log('Updating getSavingsFaqItems.ts with chain-aware logic...');
  
  // Read the current file
  const content = fs.readFileSync(savingsFilePath, 'utf8');
  
  // Extract the items array
  const match = content.match(/const items = (\[[\s\S]*?\]);[\s\S]*?return items/);
  
  if (match && match[1] && l2SavingsContent) {
    // Create the new chain-aware version using the extracted L2SavingsFaqItems
    const newContent = `import {
  isArbitrumChainId,
  isBaseChainId,
  isL2ChainId,
  isOptimismChainId,
  isUnichainChainId
} from '@jetstreamgg/sky-utils';

import {
  L2GeneralFaqItems,
  arbitrumFaqItems,
  baseFaqItems,
  optimismFaqItems,
  unichainFaqItems
} from './sharedFaqItems';
import { deduplicateFaqItems } from './utils';

export const getSavingsFaqItems = (chainId: number) => {
  const items = [
    ...generalFaqItems,
    ...L2GeneralFaqItems,
    ...(isBaseChainId(chainId) ? baseFaqItems : []),
    ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : []),
    ...(isOptimismChainId(chainId) ? optimismFaqItems : []),
    ...(isUnichainChainId(chainId) ? unichainFaqItems : []),
    ...(isL2ChainId(chainId) ? L2SavingsFaqItems : [])
  ];
  
  return deduplicateFaqItems(items);
};

const generalFaqItems = ${match[1]};

const L2SavingsFaqItems = ${l2SavingsContent};
`;
    
    fs.writeFileSync(savingsFilePath, newContent, 'utf8');
    console.log('  - Updated getSavingsFaqItems.ts with chain-aware imports and logic');
  } else {
    console.log('  - Warning: Could not extract items from getSavingsFaqItems.ts or L2SavingsFaqItems');
  }
}

// Update getTradeFaqItems.ts
if (fs.existsSync(tradeFilePath)) {
  console.log('Updating getTradeFaqItems.ts with chain-aware logic...');
  
  // Read the current file
  const content = fs.readFileSync(tradeFilePath, 'utf8');
  
  // Extract the items array
  const match = content.match(/const items = (\[[\s\S]*?\]);[\s\S]*?return items/);
  
  if (match && match[1] && l2TradeContent) {
    // Create the new chain-aware version using the extracted L2TradeFaqItems
    const newContent = `import {
  isArbitrumChainId,
  isBaseChainId,
  isL2ChainId,
  isOptimismChainId,
  isUnichainChainId
} from '@jetstreamgg/sky-utils';

import {
  L2GeneralFaqItems,
  arbitrumFaqItems,
  baseFaqItems,
  optimismFaqItems,
  unichainFaqItems
} from './sharedFaqItems';
import { deduplicateFaqItems } from './utils';

export const getTradeFaqItems = (chainId: number) => {
  const items = [
    ...generalFaqItems,
    ...L2GeneralFaqItems,
    ...(isBaseChainId(chainId) ? baseFaqItems : []),
    ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : []),
    ...(isOptimismChainId(chainId) ? optimismFaqItems : []),
    ...(isUnichainChainId(chainId) ? unichainFaqItems : []),
    ...(isL2ChainId(chainId) ? L2TradeFaqItems : [])
  ];
  
  return deduplicateFaqItems(items);
};

const generalFaqItems = ${match[1]};

const L2TradeFaqItems = ${l2TradeContent};
`;
    
    fs.writeFileSync(tradeFilePath, newContent, 'utf8');
    console.log('  - Updated getTradeFaqItems.ts with chain-aware imports and logic');
  } else {
    console.log('  - Warning: Could not extract items from getTradeFaqItems.ts or L2TradeFaqItems');
  }
}

// Clean up this script
fs.unlinkSync(__filename);
EOF

# Run the processing script
if [ -f "$DESTINATION_PATH/.process-shared-items.cjs" ]; then
    node "$DESTINATION_PATH/.process-shared-items.cjs"
fi

# Copy tooltips if they exist
if [ -d "$TEMP_DIR/$TOOLTIPS_SOURCE_PATH" ]; then
    print_status "Syncing tooltips to widgets package..."
    
    # Check if tooltips.ts exists in the output
    if [ -f "$TEMP_DIR/$TOOLTIPS_SOURCE_PATH/tooltips.ts" ]; then
        # Ensure destination directory exists
        mkdir -p "$TOOLTIPS_DESTINATION_PATH"
        
        # Copy the tooltips file to index.ts
        cp "$TEMP_DIR/$TOOLTIPS_SOURCE_PATH/tooltips.ts" "$TOOLTIPS_DESTINATION_PATH/index.ts"
        
        # Post-process the index.ts file to add fallback mechanism
        print_status "Adding fallback mechanism to tooltips..."
        
        # Create a temporary file with the modifications
        cat > "$TOOLTIPS_DESTINATION_PATH/.index.ts.tmp" << 'EOF'
import { getLegacyTooltipById } from './legacy-tooltips';

EOF
        
        # Append the original content
        cat "$TOOLTIPS_DESTINATION_PATH/index.ts" >> "$TOOLTIPS_DESTINATION_PATH/.index.ts.tmp"
        
        # Add the helper function with fallback at the end
        cat >> "$TOOLTIPS_DESTINATION_PATH/.index.ts.tmp" << 'EOF'

// Helper function to get tooltip by ID with fallback to legacy tooltips
export function getTooltipById(id: string): Tooltip | undefined {
  // First, try to find in current tooltips
  const tooltip = tooltips.find(t => t.id === id);
  if (tooltip) {
    return tooltip;
  }
  
  // If not found, fallback to legacy tooltips
  return getLegacyTooltipById(id);
}
EOF
        
        # Replace the original file
        mv "$TOOLTIPS_DESTINATION_PATH/.index.ts.tmp" "$TOOLTIPS_DESTINATION_PATH/index.ts"
        
        print_status "Tooltips synced successfully to $TOOLTIPS_DESTINATION_PATH/index.ts with fallback mechanism"
    else
        print_warning "No tooltips.ts file found in corpus output"
    fi
else
    print_warning "No tooltips directory found in corpus output"
fi

# Copy banners if they exist
if [ -d "$TEMP_DIR/$BANNERS_SOURCE_PATH" ]; then
    print_status "Syncing banners to webapp..."
    
    # Check if banners.ts exists in the output
    if [ -f "$TEMP_DIR/$BANNERS_SOURCE_PATH/banners.ts" ]; then
        # Ensure destination directory exists
        mkdir -p "$BANNERS_DESTINATION_PATH"
        
        # Copy the banners file
        cp "$TEMP_DIR/$BANNERS_SOURCE_PATH/banners.ts" "$BANNERS_DESTINATION_PATH/banners.ts"
        
        print_status "Banners synced successfully to $BANNERS_DESTINATION_PATH/banners.ts"
    else
        print_warning "No banners.ts file found in corpus output"
    fi
else
    print_warning "No banners directory found in corpus output"
fi

# Track all generated files for formatting
GENERATED_FILES=()

# Collect all FAQ files
print_status "Collecting generated files for formatting..."
for file in "$DESTINATION_PATH"/*.ts; do
    if [ -f "$file" ]; then
        # Convert to path relative to monorepo root
        GENERATED_FILES+=("apps/webapp/$file")
    fi
done

# Add tooltip file if it exists
if [ -f "$TOOLTIPS_DESTINATION_PATH/index.ts" ]; then
    GENERATED_FILES+=("packages/widgets/src/data/tooltips/index.ts")
fi

# Add banner file if it exists
if [ -f "$BANNERS_DESTINATION_PATH/banners.ts" ]; then
    GENERATED_FILES+=("apps/webapp/$BANNERS_DESTINATION_PATH/banners.ts")
fi

# Format only the generated files
if [ ${#GENERATED_FILES[@]} -gt 0 ]; then
    print_status "Formatting ${#GENERATED_FILES[@]} generated files with prettier..."
    
    # Navigate to the monorepo root to use prettier
    cd ../.. 
    
    # Format each file individually to avoid running prettier on the entire repo
    for file in "${GENERATED_FILES[@]}"; do
        npx --no-install prettier --write "$file" 2>/dev/null || true
    done
    
    # Return to webapp directory
    cd apps/webapp
    
    print_status "Files formatted successfully"
else
    print_warning "No files to format"
fi

# Clean up temp directory
print_status "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

print_status "Content sync completed successfully!"

# List the synced files
echo ""
print_status "Synced files:"

# List FAQ files
if [ -d "$DESTINATION_PATH" ]; then
    print_status "FAQ files:"
    find "$DESTINATION_PATH" -type f \( -name "*.ts" -o -name "*.json" -o -name "*.md" \) | sort | while read file; do
        echo "  - $file"
    done
fi

# List tooltip files
if [ -f "$TOOLTIPS_DESTINATION_PATH/index.ts" ]; then
    echo ""
    print_status "Tooltip files:"
    echo "  - $TOOLTIPS_DESTINATION_PATH/index.ts"
fi