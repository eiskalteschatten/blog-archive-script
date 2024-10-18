import fs from 'node:fs';
import path from 'node:path';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';

import { downloadImage, convertEscapedAscii, stripHtml } from './utils.mjs';
import { Git } from './git.mjs';

export class WordPressExporter {
  blogName;
  apiUrl;
  repoName;
  git;

  dataDirectory;
  categoriesFile;
  authorsDirectory;
  authorsFile;

  authorsUrl;
  categoriesUrl;
  postsUrl;
  tagsUrl;
  mediaUrl;

  imagesNotDownloaded = [];

  constructor(blogName, apiUrl, repoName) {
    if (!blogName || !apiUrl || !repoName) {
      throw new Error('Missing required parameters.');
    }

    this.blogName = blogName;
    this.apiUrl = apiUrl;
    this.repoName = repoName;

    this.dataDirectory = path.resolve(process.cwd(), '..', 'archive', repoName);
    this.categoriesFile = path.resolve(this.dataDirectory, 'categories.json');
    this.authorsDirectory = path.resolve(this.dataDirectory, 'authors');
    this.authorsFile = path.resolve(this.authorsDirectory, 'authors.json');

    this.authorsUrl = `${apiUrl}users`;
    this.categoriesUrl = `${apiUrl}categories`;
    this.postsUrl = `${apiUrl}posts`;
    this.tagsUrl = `${apiUrl}tags`;
    this.mediaUrl = `${apiUrl}media`;

    this.git = new Git(repoName);

    if (!fs.existsSync(this.dataDirectory)) {
      fs.mkdirSync(this.dataDirectory, { recursive: true });
    }
  }

  async export() {
    console.log(`Exporting data from Wordpress for ${this.blogName}...`);

    await this.git.pull();
    await this.fetchAuthors();
    await this.fetchCategories();
    await this.fetchPosts();

    console.log('Data successfully exported from Wordpress!');

    await this.git.commitPush();

    if (this.imagesNotDownloaded.length > 0) {
      console.log('The following images could not be downloaded:');
      console.log(JSON.stringify(this.imagesNotDownloaded, null, 2));
    }

    console.log('Finished archiving', this.blogName);
  }

  async fetchAuthors() {
    console.log('Exporting authors...');

    if (!fs.existsSync(this.authorsDirectory)) {
      await fs.promises.mkdir(this.authorsDirectory);
    }

    let newAuthors = [];

    if (fs.existsSync(this.authorsFile)) {
      const existingAuthors = await fs.promises.readFile(this.authorsFile, 'utf8');
      newAuthors = JSON.parse(existingAuthors);
    }

    const totalPagesResponse = await fetch(this.authorsUrl);
    const totalPages = totalPagesResponse.headers.get('x-wp-totalpages');

    const importData = async page => {
      const response = await fetch(`${this.authorsUrl}?page=${page}`);
      const authors = await response.json();

      for (const author of authors) {
        console.log('Exporting author:', author.name);

        const existingAuthorIndex = newAuthors.findIndex(existingAuthor => existingAuthor.id === author.slug);

        if (existingAuthorIndex > -1) {
          console.log(`Author "${author.slug}" already exists, skipping...`);
          newAuthors[existingAuthorIndex].wordpressId = author.id;
          continue;
        }

        const extention = path.extname(author.avatar_urls[96]).split('&')[0];
        const avatarFile = `${author.slug}${extention}`;
        const avatarFilePath = path.resolve(this.authorsDirectory, avatarFile);
        const imageDownloaded = await downloadImage(author.avatar_urls[96], avatarFilePath);

        if (!imageDownloaded) {
          this.imagesNotDownloaded.push(author.avatar_urls[96]);
        }

        newAuthors.push({
          id: author.slug,
          name: author.name,
          bio: author.description,
          website: author.url,
          ...imageDownloaded && {
            avatar: `/images/authors/${avatarFile}`,
          },
          wordpressId: author.id,
        });
      }
    };

    for (let page = 1; page <= totalPages; page++) {
      await importData(page);
    }

    await fs.promises.writeFile(this.authorsFile, JSON.stringify(newAuthors, null, 2));
  }

  async fetchCategories() {
    console.log('Exporting categories...');

    let newCategories = [];

    if (fs.existsSync(this.categoriesFile)) {
      const existingCategories = await fs.promises.readFile(this.categoriesFile, 'utf8');
      newCategories = JSON.parse(existingCategories);
    }

    const totalPagesResponse = await fetch(this.categoriesUrl);
    const totalPages = totalPagesResponse.headers.get('x-wp-totalpages');

    const importData = async page => {
      const response = await fetch(`${this.categoriesUrl}?page=${page}`);
      const categories = await response.json();

      for (const category of categories) {
        if (category.count === 0) {
          continue;
        }

        console.log('Exporting category:', category.name);

        const existingCategoryIndex = newCategories.findIndex(existingCategory => existingCategory.id === category.slug);

        if (existingCategoryIndex > -1) {
          console.log(`Category "${category.slug}" already exists, skipping...`);
          newCategories[existingCategoryIndex].wordpressId = category.id;
          continue;
        }

        newCategories.push({
          id: category.slug,
          name: category.name,
          description: category.description,
          wordpressId: category.id,
        });
      }
    };

    for (let page = 1; page <= totalPages; page++) {
      await importData(page);
    }

    await fs.promises.writeFile(this.categoriesFile, JSON.stringify(newCategories, null, 2));
  }

  async fetchPosts() {
    console.log('Exporting posts...');

    const totalPagesResponse = await fetch(this.postsUrl);
    const totalPages = totalPagesResponse.headers.get('x-wp-totalpages');

    const authorsFileContent = await fs.promises.readFile(this.authorsFile, 'utf8');
    const authors = JSON.parse(authorsFileContent);

    const categoriesFileContent = await fs.promises.readFile(this.categoriesFile, 'utf8');
    const categories = JSON.parse(categoriesFileContent);

    const downloadPostImage = async (src, pathToPostFolder) => {
      if (!src || !pathToPostFolder) {
        return;
      }

      const fileName = path.basename(src).split('?')[0];
      const destinationFile = path.resolve(pathToPostFolder, fileName);

      if (fs.existsSync(destinationFile)) {
        console.log(`Post image "${destinationFile}" already exists, skipping...`);
        return fileName;
      }

      const imageDownloaded = await downloadImage(src, destinationFile);

      if (!imageDownloaded) {
        this.imagesNotDownloaded.push(src);
      }

      return imageDownloaded ? fileName : undefined;
    };

    const cleanUpHtml = html => {
      const $ = cheerio.load(html);

      const figures = $('figure');
      for (const figure of figures) {
        $(figure).removeAttr('class');
      }

      const images = $('img');
      for (const image of images) {
        $(image).removeAttr('class width height data-recalc-dims sizes srcset');
      }

      const captions = $('figcaption');
      for (const caption of captions) {
        $(caption).removeAttr('class');
      }

      $('.wp-polls').html('<em>Polls have been temporarily removed while we migrate to a new platform.</em>');
      $('.wp-polls-loading').remove();

      return $.html();
    };

    const downloadAndUpdateImages = async (html, pathToPostFolder) => {
      const $ = cheerio.load(html);
      const images = $('img');

      for (const image of images) {
        const src = $(image).attr('src');
        const newSrc = await downloadPostImage(src, pathToPostFolder);
        $(image).attr('src', newSrc);
      }

      return $.html();
    };

    const importData = async page => {
      const response = await fetch(`${this.postsUrl}?page=${page}`);
      const posts = await response.json();

      for (const post of posts) {
        const postTitle = convertEscapedAscii(post.title.rendered);

        console.log('Exporting post:', postTitle);

        const pathToPostFolder = path.resolve(this.dataDirectory, 'posts', post.slug);

        if (!fs.existsSync(pathToPostFolder)) {
          await fs.promises.mkdir(pathToPostFolder, { recursive: true });
        }

        const postAuthor = authors.find(author => post.author === author.wordpressId);
        const postCategories = categories.filter(category => post.categories.includes(category.wordpressId));

        const titleImageId = post.featured_media;
        const titleImageResponse = await fetch(`${this.mediaUrl}/${titleImageId}`);
        const titleImageJson = await titleImageResponse.json();
        const titleImage = await downloadPostImage(titleImageJson.source_url, pathToPostFolder);

        const tags = [];

        for (const tag of post.tags) {
          const tagId = await this.fetchTag(tag);
          tags.push(tagId);
        }

        const metaData = {
          id: post.slug,
          title: postTitle,
          status: post.status === 'publish' ? 'published' : 'draft',
          authors: [postAuthor.id],
          titleImage,
          excerpt: stripHtml(post.excerpt.rendered),
          categories: postCategories.map(category => category.id),
          tags,
          publishedDate: post.date,
          updatedAt: post.modified,
          wordpressId: post.id,
        };

        const metaDataFile = path.resolve(pathToPostFolder, 'meta.json');
        await fs.promises.writeFile(metaDataFile, JSON.stringify(metaData, null, 2));

        const cleanedContent = cleanUpHtml(post.content.rendered);
        const htmlWithImages = await downloadAndUpdateImages(cleanedContent, pathToPostFolder);

        const turndownService = new TurndownService({
          bulletListMarker: '-',
          codeBlockStyle: 'fenced',
          emDelimiter: '*',
        });

        turndownService.keep(['figure', 'figcaption']);

        const content = turndownService.turndown(htmlWithImages);
        const contentFile = path.resolve(pathToPostFolder, 'index.md');
        await fs.promises.writeFile(contentFile, content);
      }
    };

    for (let page = 1; page <= totalPages; page++) {
      await importData(page);
    }
  }

  async fetchTag(tagId) {
    const response = await fetch(`${this.tagsUrl}/${tagId}`);
    const tag = await response.json();
    return tag.name;
  }
}
