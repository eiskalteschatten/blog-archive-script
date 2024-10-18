import { WordPressExporter } from './exporter.mjs';

const blogUrls = [
  ['alexsnotebook', 'https://blog.alexseifert.com/wp-json/wp/v2/'],
  ['hauntingalex', 'https://haunting.alexseifert.com/wp-json/wp/v2/'],
  ['historyrhymes', 'https://www.historyrhymes.info/wp-json/wp/v2/'],
  ['thebeskirtedman', 'https://www.the-beskirted-man.com/wp-json/wp/v2/'],
];

for (const [blogName, apiUrl] of blogUrls) {
  const exporter = new WordPressExporter(blogName, apiUrl);
  // await exporter.export();
}
