# Teachers Repository — Wikipefia

This is the **unified teachers content repository** for [Wikipefia](https://github.com/org/wikipefia). All teacher profiles live in this single repo, each in their own directory.

## Quick Start

1. **Add a new teacher** → create a new directory `<teacher-slug>/` with `config.json` and `articles/`.
2. **Write articles** → add MDX files under `<teacher-slug>/articles/{locale}/`. Each locale must have `_front.mdx`.
3. **Push to main** → the `notify-main.yml` workflow triggers a full site rebuild.

## Repository Structure

```
teachers-repo-template/
├── ivan-petrov/                        # One directory per teacher
│   ├── config.json                     # Teacher metadata (schema-validated)
│   ├── articles/
│   │   ├── en/
│   │   │   ├── _front.mdx              # Required: teacher profile / front page
│   │   │   ├── teaching-philosophy.mdx # Teacher article
│   │   │   └── study-guide.mdx         # Another teacher article
│   │   ├── ru/
│   │   │   ├── _front.mdx
│   │   │   ├── teaching-philosophy.mdx
│   │   │   └── study-guide.mdx
│   │   └── cz/
│   │       └── _front.mdx
│   └── assets/
│       └── photo.jpg
├── maria-novakova/
│   ├── config.json
│   ├── articles/ ...
│   └── assets/ ...
├── scripts/
│   └── validate-content.ts            # Validates all teachers at once
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/
        ├── validate.yml               # CI: validates all teacher content on PRs
        └── notify-main.yml            # CD: triggers main repo rebuild
```

## Teacher Config Schema

Each `<teacher-slug>/config.json` must conform to the `TeacherConfig` Zod schema:

| Field | Type | Required | Description |
|---|---|---|---|
| `slug` | `string` | Yes | URL-safe identifier (`^[a-z0-9-]+$`). Must match directory name. |
| `name` | `LocalizedString` | Yes | Teacher's name in all locales. |
| `description` | `LocalizedString` | Yes | Short bio in all locales. |
| `photo` | `string` | No | Path to photo relative to teacher directory. |
| `subjects` | `string[]` | Yes | Subject slugs this teacher is associated with. |
| `ratings` | `Ratings` | Yes | `overall`, `clarity`, `difficulty`, `usefulness` (0–5), `count`. |
| `keywords` | `LocalizedKeywords` | Yes | Search keywords per locale. |
| `contacts.email` | `string` | No | Email address. |
| `contacts.office` | `LocalizedString` | No | Office location in all locales. |
| `contacts.website` | `string` | No | Personal website URL. |
| `reviews[]` | `Review[]` | No | Student reviews with `text`, `rating`, `date`, `anonymous`. |
| `sections[]` | `Section[]` | No | Organize articles into named sections. |

## Article Frontmatter

Same `ArticleFrontmatter` schema as subject articles. See the subject repo template for full reference.

## Adding a New Teacher

1. Create a new directory: `mkdir -p new-teacher/articles/{en,ru,cz} new-teacher/assets`
2. Create `new-teacher/config.json` — copy from an existing teacher and modify.
3. Create `new-teacher/articles/en/_front.mdx` (at minimum).
4. Run `pnpm validate` to check everything is correct.
5. Submit a PR.

## CI/CD

- **`validate.yml`**: Runs on every push/PR. Validates all teacher configs, all article frontmatter, structure, and cross-references.
- **`notify-main.yml`**: On push to main, dispatches a `content-updated` event to the Wikipefia main repo.

## Local Development

```bash
pnpm install
pnpm validate
```
