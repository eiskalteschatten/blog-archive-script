import 'dotenv/config';

import { WordPressExporter } from './exporter.mjs';

const blogUrls = [
  ['alexsnotebook', 'https://blog.alexseifert.com/wp-json/wp/v2/', 'blog-archive-alexsnotebook'],
  ['hauntingalex', 'https://haunting.alexseifert.com/wp-json/wp/v2/', 'blog-archive-hauntingalex'],
  // ['historyrhymes', 'https://www.historyrhymes.info/wp-json/wp/v2/', ''],
  // ['thebeskirtedman', 'https://www.the-beskirted-man.com/wp-json/wp/v2/', ''],
];

for (const [blogName, apiUrl, gitHubRepo] of blogUrls) {
  const exporter = new WordPressExporter(blogName, apiUrl, gitHubRepo);
  await exporter.export();
}
