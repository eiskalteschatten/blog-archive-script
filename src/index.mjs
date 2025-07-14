import { WordPressExporter } from './exporter.mjs';

const blogUrls = [
  ['alexsnotebook', 'https://blog.alexseifert.com/wp-json/wp/v2/', 'blog-archive-alexsnotebook'],
  ['alexnotizbuch', 'https://blog.alexseifert.de/wp-json/wp/v2/', 'blog-archive-alexnotizbuch'],
  ['hauntingalex', 'https://haunting.alexseifert.com/wp-json/wp/v2/', 'blog-archive-hauntingalex'],
  ['thebeskirtedman', 'https://www.the-beskirted-man.com/wp-json/wp/v2/', 'blog-archive-thebeskirtedman'],
  ['historyrhymes', 'https://www.historyrhymes.info/wp-json/wp/v2/', 'blog-archive-historyrhymes'],
];

for (const [blogName, apiUrl, repoName] of blogUrls) {
  const exporter = new WordPressExporter(blogName, apiUrl, repoName);
  await exporter.export();
  console.log('------------');
}
