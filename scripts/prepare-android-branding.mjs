import { mkdir, writeFile, readFile } from 'node:fs/promises';

const root = new URL('../android/app/src/main/res/', import.meta.url);

const write = async (rel, content) => {
  const url = new URL(rel, root);
  await mkdir(new URL('.', url), { recursive: true });
  await writeFile(url, content, 'utf8');
};

const foreground = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#FFFFFFFF"
      android:pathData="M30,22h48v12H43v12h30v12H43v28H30z"/>
  <circle android:fillColor="#FFFFFFFF" android:cx="78" android:cy="84" android:r="5"/>
</vector>`;

await write('drawable/frame_icon_foreground.xml', foreground);

await write('drawable/frame_splash.xml', `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/frame_background"/>
  <item android:drawable="@drawable/frame_icon_foreground"/>
</layer-list>`);

const colorsUrl = new URL('values/colors.xml', root);
await mkdir(new URL('.', colorsUrl), { recursive: true });

let colors = '';
try {
  colors = await readFile(colorsUrl, 'utf8');
} catch {}

if (!/<resources(?:\s[^>]*)?>/.test(colors)) {
  colors = `<?xml version="1.0" encoding="utf-8"?>
<resources>
</resources>
`;
}

if (!colors.includes('name="frame_background"')) {
  colors = colors.replace(
    /<\/resources>\s*$/,
    '  <color name="frame_background">#09090D</color>\n</resources>\n',
  );
}

await writeFile(colorsUrl, colors, 'utf8');

for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  await write(
    `mipmap-anydpi-v26/${name}`,
    `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/frame_background"/>
  <foreground android:drawable="@drawable/frame_icon_foreground"/>
</adaptive-icon>
`,
  );
}

const stylesUrl = new URL('values/styles.xml', root);
let styles = await readFile(stylesUrl, 'utf8');
styles = styles.replaceAll(
  '<item name="android:background">@drawable/splash</item>',
  '<item name="android:background">@drawable/frame_splash</item>',
);
await writeFile(stylesUrl, styles, 'utf8');
