#!/usr/bin/env node
/**
 * validate-content.ts — Content validation for the unified teachers repository.
 *
 * Validates ALL teachers in this repo:
 *   1. Each teacher directory has config.json conforming to TeacherConfig schema
 *   2. All MDX frontmatter conforms to ArticleFrontmatter schema
 *   3. Each locale directory has _front.mdx
 *   4. Articles referenced in sections exist as MDX files
 *   5. No slug collisions between teachers
 *   6. Slug matches directory name
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { z } from "zod/v4";
import matter from "gray-matter";

// ── Constants ──────────────────────────────────────────

const ROOT = process.cwd();
const LOCALES = ["ru", "en", "cz"] as const;

// Directories to skip (not teacher directories)
const SKIP_DIRS = new Set([
  "node_modules", "scripts", ".github", ".git", "dist",
]);

// ── Zod Schemas ────────────────────────────────────────

const LocalizedString = z.object({
  ru: z.string(),
  en: z.string(),
  cz: z.string(),
});

const LocalizedKeywords = z.object({
  ru: z.array(z.string()),
  en: z.array(z.string()),
  cz: z.array(z.string()),
});

const TeacherConfig = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: LocalizedString,
  description: LocalizedString,
  photo: z.string().optional(),
  subjects: z.array(z.string()),
  ratings: z.object({
    overall: z.number().min(0).max(5),
    clarity: z.number().min(0).max(5),
    difficulty: z.number().min(0).max(5),
    usefulness: z.number().min(0).max(5),
    count: z.number().int().min(0),
  }),
  keywords: LocalizedKeywords,
  contacts: z
    .object({
      email: z.string().email().optional(),
      office: LocalizedString.optional(),
      website: z.string().url().optional(),
    })
    .optional(),
  reviews: z
    .array(
      z.object({
        text: LocalizedString,
        rating: z.number().min(1).max(5),
        date: z.string(),
        anonymous: z.boolean().default(true),
      })
    )
    .optional(),
  sections: z
    .array(
      z.object({
        slug: z.string(),
        name: LocalizedString,
        articles: z.array(z.string()),
      })
    )
    .optional(),
});

const ArticleFrontmatter = z.object({
  title: LocalizedString,
  slug: z.string().regex(/^[a-z0-9_-]+$/),
  author: z.string().optional(),
  keywords: LocalizedKeywords,
  created: z.string(),
  updated: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  estimatedReadTime: z.number().optional(),
  prerequisites: z.array(z.string()).optional(),
  tutors: z.array(z.string()).optional(),
});

// ── Utilities ──────────────────────────────────────────

let errorCount = 0;
let warnCount = 0;

function logError(msg: string) {
  console.error(`  ✗ ERROR: ${msg}`);
  errorCount++;
}

function logWarn(msg: string) {
  console.warn(`  ⚠ WARN:  ${msg}`);
  warnCount++;
}

function logOk(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function listMdxFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (f) => f.endsWith(".mdx") && statSync(path.join(dir, f)).isFile()
  );
}

function listTeacherDirs(): string[] {
  return readdirSync(ROOT)
    .filter((name) => {
      if (SKIP_DIRS.has(name) || name.startsWith(".")) return false;
      const fullPath = path.join(ROOT, name);
      return statSync(fullPath).isDirectory() && existsSync(path.join(fullPath, "config.json"));
    });
}

// ── Validate a single teacher ──────────────────────────

function validateTeacher(
  dirName: string
): z.infer<typeof TeacherConfig> | null {
  const teacherDir = path.join(ROOT, dirName);
  const configPath = path.join(teacherDir, "config.json");

  console.log(`\n▸ Validating teacher: ${dirName}`);

  // 1. Validate config.json
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (e) {
    logError(`${dirName}/config.json is not valid JSON: ${e}`);
    return null;
  }

  const result = TeacherConfig.safeParse(raw);
  if (!result.success) {
    logError(`${dirName}/config.json schema validation failed:`);
    for (const issue of result.error.issues) {
      logError(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    return null;
  }

  const config = result.data;

  // Check slug matches directory name
  if (config.slug !== dirName) {
    logError(
      `${dirName}/config.json: slug "${config.slug}" does not match directory name "${dirName}"`
    );
  }

  logOk(`${dirName}/config.json valid (slug: "${config.slug}")`);

  // 2. Validate structure
  const articlesDir = path.join(teacherDir, "articles");
  if (!existsSync(articlesDir)) {
    logError(`${dirName}/articles/ directory not found`);
    return config;
  }

  const localeDirs = LOCALES.filter((l) =>
    existsSync(path.join(articlesDir, l))
  );

  if (localeDirs.length === 0) {
    logError(`${dirName}/articles/ has no locale directories`);
    return config;
  }

  // Check _front.mdx
  let hasFront = false;
  for (const locale of localeDirs) {
    const frontPath = path.join(articlesDir, locale, "_front.mdx");
    if (existsSync(frontPath)) {
      hasFront = true;
    } else {
      logError(`${dirName}/articles/${locale}/_front.mdx is missing`);
    }
  }

  if (!hasFront) {
    logError(`${dirName}: No _front.mdx found in any locale`);
  }

  // 3. Validate frontmatter
  for (const locale of localeDirs) {
    const localeDir = path.join(articlesDir, locale);
    const files = listMdxFiles(localeDir);
    for (const file of files) {
      const filePath = path.join(localeDir, file);
      const rawContent = readFileSync(filePath, "utf-8");

      let parsed;
      try {
        parsed = matter(rawContent);
      } catch (e) {
        logError(`${dirName}/articles/${locale}/${file}: Failed to parse frontmatter: ${e}`);
        continue;
      }

      const fmResult = ArticleFrontmatter.safeParse(parsed.data);
      if (!fmResult.success) {
        logError(`${dirName}/articles/${locale}/${file}: Frontmatter validation failed:`);
        for (const issue of fmResult.error.issues) {
          logError(`  ${issue.path.join(".")}: ${issue.message}`);
        }
        continue;
      }

      // Check slug matches filename
      const expectedSlug = path.basename(file, ".mdx");
      if (fmResult.data.slug !== expectedSlug) {
        logError(
          `${dirName}/articles/${locale}/${file}: slug "${fmResult.data.slug}" ` +
            `does not match filename "${expectedSlug}"`
        );
        continue;
      }

      logOk(`${dirName}/articles/${locale}/${file} — valid`);
    }
  }

  // 4. Cross-validate sections ↔ articles
  if (config.sections && config.sections.length > 0) {
    const allArticleSlugs = new Set<string>();
    for (const locale of LOCALES) {
      const localeDir = path.join(articlesDir, locale);
      if (!existsSync(localeDir)) continue;
      for (const f of listMdxFiles(localeDir)) {
        const slug = path.basename(f, ".mdx");
        if (slug !== "_front") allArticleSlugs.add(slug);
      }
    }

    const referencedSlugs = new Set<string>();
    for (const sec of config.sections) {
      for (const articleSlug of sec.articles) {
        if (referencedSlugs.has(articleSlug)) {
          logError(`${dirName}: Article "${articleSlug}" listed in multiple sections`);
        }
        referencedSlugs.add(articleSlug);

        if (!allArticleSlugs.has(articleSlug)) {
          logError(
            `${dirName}: Section "${sec.slug}" references article "${articleSlug}" ` +
              `but no MDX file found`
          );
        }
      }
    }

    for (const slug of allArticleSlugs) {
      if (!referencedSlugs.has(slug)) {
        logWarn(`${dirName}: Article "${slug}" exists but is not in any section`);
      }
    }
  }

  return config;
}

// ── Main ───────────────────────────────────────────────

function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  WIKIPEFIA TEACHERS CONTENT VALIDATOR        ║");
  console.log("╚══════════════════════════════════════════════╝");

  const teacherDirs = listTeacherDirs();

  if (teacherDirs.length === 0) {
    logError("No teacher directories found (looking for dirs with config.json)");
  } else {
    console.log(`\nFound ${teacherDirs.length} teacher(s): ${teacherDirs.join(", ")}`);
  }

  // Validate each teacher
  const slugs = new Map<string, string>();
  for (const dir of teacherDirs) {
    const config = validateTeacher(dir);
    if (config) {
      // Check for slug collisions between teachers
      const existing = slugs.get(config.slug);
      if (existing) {
        logError(
          `SLUG COLLISION: Teachers "${existing}" and "${dir}" both use slug "${config.slug}"`
        );
      }
      slugs.set(config.slug, dir);
    }
  }

  // Summary
  console.log("\n" + "─".repeat(48));
  console.log(`Teachers validated: ${teacherDirs.length}`);
  if (errorCount > 0) {
    console.error(
      `\n✗ Validation FAILED: ${errorCount} error(s), ${warnCount} warning(s)\n`
    );
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(`\n✓ Validation passed with ${warnCount} warning(s)\n`);
  } else {
    console.log("\n✓ Validation passed — all checks green!\n");
  }
}

main();
