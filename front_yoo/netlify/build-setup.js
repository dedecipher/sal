const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Function to copy directory recursively
function copyDirectory(source, destination) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  // Get all files in source directory
  const files = fs.readdirSync(source);

  // Copy each file to destination
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const destPath = path.join(destination, file);

    // Get file stats
    const stats = fs.statSync(sourcePath);

    if (stats.isDirectory()) {
      // Recursively copy subdirectories
      copyDirectory(sourcePath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

// Main execution
console.log("Setting up build environment for Netlify...");

// Path to the SDK dist
const sdkDistPath = path.resolve(
  __dirname,
  "../../packages/gibberlink-sdk/dist"
);
const sdkDestPath = path.resolve(__dirname, "../node_modules/gibberlink-sdk");

// Check if SDK dist exists
if (fs.existsSync(sdkDistPath)) {
  console.log(`Found SDK at: ${sdkDistPath}`);

  // Ensure node_modules exists
  if (!fs.existsSync(path.resolve(__dirname, "../node_modules"))) {
    fs.mkdirSync(path.resolve(__dirname, "../node_modules"), {
      recursive: true,
    });
  }

  // Copy SDK to node_modules
  console.log(`Copying SDK to: ${sdkDestPath}`);
  copyDirectory(sdkDistPath, sdkDestPath);
  console.log("SDK copied successfully");
} else {
  console.error(`ERROR: SDK dist not found at: ${sdkDistPath}`);
  process.exit(1);
}

console.log("Build setup completed successfully");
