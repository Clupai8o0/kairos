# Kairos Example Plugins

Reference implementations of Kairos scratchpad plugins. Copy, modify, and publish.

| Plugin | Input type | What it does |
|---|---|---|
| `kairos-plugin-instagram` | `url` | Extracts tasks from an Instagram post or reel URL |
| `kairos-plugin-twitter` | `url` | Extracts tasks from a tweet or thread URL |
| `kairos-plugin-readwise` | `text` | Converts Readwise highlight exports into reading tasks |
| `kairos-plugin-voice` | `voice` | Transcribes a voice memo and extracts action items |

## Getting started

1. Copy a plugin directory: `cp -r kairos-plugin-instagram my-plugin`
2. Edit `package.json` (change `name`, `description`)
3. Implement `src/index.ts`
4. `pnpm install && pnpm build`
5. Install into Kairos: set `KAIROS_EXTRA_PLUGINS=/path/to/my-plugin/dist/index.js`

Full guide: [kairos.app/docs/plugins](https://kairos.app/docs/plugins)
