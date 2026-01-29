import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { execSync } from "child_process";
import * as readline from "readline";

// --- Types & Interfaces ---

interface ProductSchema {
  articleNumber: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  size: string;
  visible: boolean;
  customizable: boolean;
}

interface SourceProduct {
  isValid: boolean;
  validationErrors: string[];
  data?: ProductSchema;
  imagePaths: string[];
  sourcePath: string; // Path to the product folder
}

interface HandmadeJson {
  products: ProductSchema[];
}

interface SyncAction {
  type:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "IGNORE"
    | "IMAGE_UPDATE"
    | "IMAGE_DELETE"
    | "IMAGE_FOLDER_DELETE"
    | "IMAGE_CREATE";
  reason?: string;
  details: string;
  product?: ProductSchema;
  targetPath?: string;
  sourcePath?: string;
}

// --- Configuration ---

const VALID_CATEGORIES = ["3D", "EP", "WO", "LA"];
const ARTICLE_NUMBER_REGEX = /^(3D|EP|WO|LA)[0-9a-zA-Z]{4}$/;
const IMAGE_REGEX = /^[0-9a-zA-Z]{6}-\d{2}\.(png|jpg|jpeg)$/i; // Case insensitive for extension
const SCHEMA_REQUIRED_FIELDS = [
  "name",
  "description",
  "tags",
  "price",
  "size",
  "visible",
  "customizable",
];

// --- Helpers ---

function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

function formatDate(date: Date): string {
  return date
    .toISOString()
    .replace(/T/, "_")
    .replace(/\..+/, "")
    .replace(/:/g, "-");
}

// --- Main Class ---

class ProductSynchronizer {
  private sourceDir: string;
  private targetDataPath: string;
  private targetAssetsPath: string;
  private validTags: string[] = [];
  private sourceProducts: Map<string, SourceProduct> = new Map();
  private actions: SyncAction[] = [];
  private logFileContent: string[] = [];

  constructor(sourceDir: string) {
    this.sourceDir = sourceDir;
    // Paths relative to project root (assuming script is run from project root or we determine it)
    // Adjust these to be absolute if needed, but relative to CWD is usually fine for scripts
    this.targetDataPath = path.resolve("public/data/handmade.json");
    this.targetAssetsPath = path.resolve("src/assets/handmade");
  }

  private log(message: string) {
    console.log(message);
    this.logFileContent.push(message);
  }

  public async run() {
    this.log(`Starting synchronization scan...`);
    this.log(`Source: ${this.sourceDir}`);

    if (!fs.existsSync(this.sourceDir)) {
      this.log(`Error: Source directory not found: ${this.sourceDir}`);
      return;
    }

    // 1. Load Tags
    this.loadTags();

    // 2. Scan Source
    this.scanSource();

    // 3. Analyze Actions
    this.analyzeActions();

    // 4. Summary & Prompt
    this.printSummary();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "Do you want to proceed with the synchronization? (y/N) ",
      (answer) => {
        if (answer.toLowerCase() === "y") {
          this.executeSync();
          rl.close();
        } else {
          this.log("Aborted by user.");
          rl.close();
        }
      }
    );
  }

  private loadTags() {
    const tagsPath = path.join(this.sourceDir, "tags.json");
    if (fs.existsSync(tagsPath)) {
      try {
        const tagsRaw = fs.readFileSync(tagsPath, "utf8");
        this.validTags = JSON.parse(tagsRaw);
        this.log(`Loaded ${this.validTags.length} valid tags.`);
      } catch (e) {
        this.log(`Error loading tags.json: ${e}`);
      }
    } else {
      this.log(`Warning: categories.json not found at ${tagsPath}`);
    }
  }

  private scanSource() {
    const categories = fs
      .readdirSync(this.sourceDir)
      .filter((f) => fs.statSync(path.join(this.sourceDir, f)).isDirectory());

    for (const cat of categories) {
      if (!VALID_CATEGORIES.includes(cat)) {
        this.actions.push({
          type: "IGNORE",
          details: `Invalid category folder: ${cat}`,
          reason: "Category not in schema",
        });
        continue;
      }

      const catDir = path.join(this.sourceDir, cat);
      const products = fs
        .readdirSync(catDir)
        .filter((f) => fs.statSync(path.join(catDir, f)).isDirectory());

      for (const prodFolder of products) {
        this.validateAndLoadProduct(cat, prodFolder);
      }
    }
  }

  private validateAndLoadProduct(category: string, folderName: string) {
    const errors: string[] = [];
    const fullPath = path.join(this.sourceDir, category, folderName);

    // check folder name (Article Number + Description usually, but requirements say "ArticleNumber")
    // The requirements say: "Folder consisting of ArticleNumber and a short description".
    // BUT also says "Validation: Product folder corresponds not to schema <LA|EP...>"
    // Let's assume the folder STARTS with the article number. The article number is 6 chars.

    let articleNumber = folderName;
    // Try to extract article number if folder name is like "WO1234 - Description"
    // Requirement says: "Folder: <artikelnummer-produkt>" e.g. "WO1234-tolles-holz" (inferred)
    // Schema says Article Number: Category (2) + 4 random chars. Length 6.

    const possibleArticleNumber = folderName.substring(0, 6);
    if (!ARTICLE_NUMBER_REGEX.test(possibleArticleNumber)) {
      this.actions.push({
        type: "IGNORE",
        details: `Invalid product folder name: ${folderName}`,
        reason: "Does not start with valid Article Number",
      });
      return;
    }
    articleNumber = possibleArticleNumber;

    // JSON File
    const jsonFiles = fs
      .readdirSync(fullPath)
      .filter((f) => f.toLowerCase().endsWith(".json"));
    if (jsonFiles.length === 0) {
      this.actions.push({
        type: "IGNORE",
        details: `No JSON file in ${folderName}`,
        reason: "Missing JSON",
      });
      return;
    }
    // Requirement: "File: <articleNumber>.JSON".
    const expectedJsonName = `${articleNumber}.json`.toLowerCase();
    const jsonFile = jsonFiles.find(
      (f) => f.toLowerCase() === expectedJsonName
    );

    if (!jsonFile) {
      this.actions.push({
        type: "IGNORE",
        details: `JSON file ${expectedJsonName} not found in ${folderName}`,
        reason: "Missing matching JSON file",
      });
      return;
    }

    let productData: any;
    try {
      const content = fs.readFileSync(path.join(fullPath, jsonFile), "utf8");
      productData = JSON.parse(content);
    } catch (e) {
      this.actions.push({
        type: "IGNORE",
        details: `Invalid JSON in ${folderName}`,
        reason: "JSON Parse Error",
      });
      return;
    }

    // Validate Schema
    for (const field of SCHEMA_REQUIRED_FIELDS) {
      if (!(field in productData)) {
        errors.push(`Missing field: ${field}`);
      }
    }

    // Validate Tags
    if (productData.tags && Array.isArray(productData.tags)) {
      for (const tag of productData.tags) {
        if (!this.validTags.includes(tag)) {
          errors.push(`Invalid tag: ${tag}`);
        }
      }
    }

    // Validate Images
    const imageFiles = fs
      .readdirSync(fullPath)
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
    const validImages: string[] = [];

    for (const img of imageFiles) {
      // Requirement: <artikelnummer>-<01-99>.PNG
      if (
        img.toLowerCase().startsWith(articleNumber.toLowerCase() + "-") &&
        IMAGE_REGEX.test(img)
      ) {
        validImages.push(img);
      } else {
        // Not necessarily an error, maybe just some other file, but requirement says "Ignore if images do not match schema"
        // Actually requirement says: "Ignore product if: Single or all source images do not match schema".
        // That's strict. Let's log it.
        errors.push(`Invalid image filename: ${img}`);
      }
    }

    if (errors.length > 0) {
      this.actions.push({
        type: "IGNORE",
        details: `Validation failed for ${folderName}`,
        reason: errors.join(", "),
      });
      return;
    }

    // augment data with Article Number and Category if not present or overwrite to ensure consistency
    const finalProduct: ProductSchema = {
      ...productData,
      articleNumber: articleNumber,
      category: category,
    };

    this.sourceProducts.set(articleNumber, {
      isValid: true,
      validationErrors: [],
      data: finalProduct,
      imagePaths: validImages,
      sourcePath: fullPath,
    });
  }

  private analyzeActions() {
    // Read existing handmade.json
    let targetProducts: ProductSchema[] = [];
    if (fs.existsSync(this.targetDataPath)) {
      try {
        const content = fs.readFileSync(this.targetDataPath, "utf8");
        const data = JSON.parse(content) as HandmadeJson;
        targetProducts = data.products || [];
      } catch (e) {
        this.log(`Error reading target JSON: ${e}`);
      }
    }

    const targetMap = new Map(targetProducts.map((p) => [p.articleNumber, p]));

    // 1. Updates & Creates
    for (const [artNum, sourceProd] of this.sourceProducts) {
      if (targetMap.has(artNum)) {
        // Check if data changed
        const targetProd = targetMap.get(artNum)!;
        // Simple stringify comparison for data equality
        if (JSON.stringify(targetProd) !== JSON.stringify(sourceProd.data)) {
          this.actions.push({
            type: "UPDATE",
            details: `Update metadata for ${artNum}`,
            product: sourceProd.data,
          });
        }
      } else {
        this.actions.push({
          type: "CREATE",
          details: `New product ${artNum}`,
          product: sourceProd.data,
        });
      }

      // Check Images
      this.analyzeImages(artNum, sourceProd);
    }

    // 2. Deletes (Products in target but not in source)
    for (const [artNum, targetProd] of targetMap) {
      if (!this.sourceProducts.has(artNum)) {
        this.actions.push({
          type: "DELETE",
          details: `Delete product ${artNum}`,
          product: targetProd,
        });
        // Also delete images
        // traversing assets folder to find related images
        const assetDir = path.join(
          this.targetAssetsPath,
          targetProd.category,
          targetProd.articleNumber
        );
        if (fs.existsSync(assetDir)) {
          this.actions.push({
            type: "IMAGE_FOLDER_DELETE",
            details: `Delete asset folder for ${artNum}`,
            targetPath: assetDir,
          });
        }
      }
    }
  }

  private analyzeImages(articleNumber: string, sourceProd: SourceProduct) {
    const category = sourceProd.data!.category;
    const targetDir = path.join(this.targetAssetsPath, category, articleNumber);

    // We know source images from scanSource

    if (!fs.existsSync(targetDir)) {
      // All images are new
      for (const img of sourceProd.imagePaths) {
        this.actions.push({
          type: "IMAGE_CREATE",
          details: `Copy image ${img}`,
          sourcePath: path.join(sourceProd.sourcePath, img),
          targetPath: path.join(targetDir, img),
        });
      }
      return;
    }

    // Compare hashes
    const targetImages = fs
      .readdirSync(targetDir)
      .filter((f) => f.toLowerCase().endsWith(".png"));

    // 1. Images to Copy/Update
    for (const img of sourceProd.imagePaths) {
      const srcPath = path.join(sourceProd.sourcePath, img);
      const tgtPath = path.join(targetDir, img);

      if (!fs.existsSync(tgtPath)) {
        this.actions.push({
          type: "IMAGE_CREATE",
          details: `Copy new image ${img}`,
          sourcePath: srcPath,
          targetPath: tgtPath,
        });
      } else {
        const srcHash = calculateFileHash(srcPath);
        const tgtHash = calculateFileHash(tgtPath);
        if (srcHash !== tgtHash) {
          this.actions.push({
            type: "IMAGE_UPDATE",
            details: `Update image ${img} (hash mismatch)`,
            sourcePath: srcPath,
            targetPath: tgtPath,
          });
        }
      }
    }

    // 2. Images to Delete (in target but not in source)
    for (const img of targetImages) {
      if (!sourceProd.imagePaths.includes(img)) {
        this.actions.push({
          type: "IMAGE_DELETE",
          details: `Delete orphaned image ${img}`,
          targetPath: path.join(targetDir, img),
        });
      }
    }
  }

  private printSummary() {
    this.log("\n--- Synchronization Summary ---");
    const grouped = this.actions.reduce(
      (acc, action) => {
        acc[action.type] = (acc[action.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    for (const [type, count] of Object.entries(grouped)) {
      this.log(`${type}: ${count}`);
    }

    if (this.actions.length === 0) {
      this.log("No changes detected.");
    } else {
      this.log("Details:");
      this.actions.forEach((a) =>
        this.log(
          `[${a.type}] ${a.details} ${a.reason ? `(Reason: ${a.reason})` : ""}`
        )
      );
    }
    this.log("-------------------------------\n");
  }

  private executeSync() {
    this.log("Executing synchronization...");

    // 0. Create Branch
    const branchName = `chore/synchronize-products-${formatDate(new Date())}`;
    try {
      execSync(`git checkout -b ${branchName}`);
      this.log(`Created and checked out branch ${branchName}`);
    } catch (e) {
      this.log(`Error creating branch: ${e}`);
      // proceed? Maybe we are already on a branch or want to continue anyway.
    }

    // 1. Update handmade.json
    // Reconstruct the full list
    const validSourceProducts = Array.from(this.sourceProducts.values()).map(
      (sp) => sp.data!
    );
    // Sort maybe? for consistency?
    validSourceProducts.sort((a, b) =>
      a.articleNumber.localeCompare(b.articleNumber)
    );

    const jsonOutput: HandmadeJson = { products: validSourceProducts };

    fs.writeFileSync(this.targetDataPath, JSON.stringify(jsonOutput, null, 2));
    this.log(`Updated ${this.targetDataPath}`);

    // 2. Perform Image Actions
    for (const action of this.actions) {
      try {
        if (action.type === "IMAGE_CREATE" || action.type === "IMAGE_UPDATE") {
          if (action.sourcePath && action.targetPath) {
            const targetDir = path.dirname(action.targetPath);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            fs.copyFileSync(action.sourcePath, action.targetPath);
            this.log(`Copied ${path.basename(action.sourcePath)}`);
          }
        } else if (action.type === "IMAGE_DELETE") {
          if (action.targetPath && fs.existsSync(action.targetPath)) {
            fs.unlinkSync(action.targetPath);
            this.log(`Deleted file ${action.targetPath}`);
          }
        } else if (action.type === "IMAGE_FOLDER_DELETE") {
          if (
            action.targetPath &&
            fs.existsSync(action.targetPath) &&
            fs.statSync(action.targetPath).isDirectory()
          ) {
            fs.rmSync(action.targetPath, { recursive: true, force: true });
            this.log(`Deleted folder ${action.targetPath}`);
          }
        }
      } catch (e) {
        this.log(`Error executing ${action.type} on ${action.details}: ${e}`);
      }
    }

    // 3. Write Log File
    const logDir = path.resolve("scripts/synchronize-products");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFileName = `synchronize-products-${formatDate(new Date())}.md`;
    const logPath = path.join(logDir, logFileName);

    const logContent =
      `# Synchronization Log ${new Date().toISOString()}\n\n` +
      this.logFileContent.join("\n");

    fs.writeFileSync(logPath, logContent);
    this.log(`Log file written to ${logPath}`);

    this.log("Done.");
  }
}

// --- Entry Point ---

const args = process.argv.slice(2);

function start(dir: string) {
  // Remove quotes if user added them when pasting path
  const cleanDir = dir.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  const syncer = new ProductSynchronizer(cleanDir);
  syncer.run();
}

if (args.length > 0) {
  start(args[0]);
} else {
  const rlArgs = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rlArgs.question("Please provide the source directory path: ", (answer) => {
    rlArgs.close();
    if (!answer.trim()) {
      console.error("No path provided. Exiting.");
      process.exit(1);
    }
    start(answer.trim());
  });
}
