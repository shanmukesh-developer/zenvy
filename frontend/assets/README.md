# Custom Android Icons

1. Rename your beautiful copper Zenvy logo to `icon.png`
2. Place it exactly in this folder (`c:\hostel-bite\frontend\assets\icon.png`)
3. Open a terminal in `c:\hostel-bite\frontend` and run:
   > `npx @capacitor/assets generate --android`
4. The tool will automatically slice and resize your image into all the required Android sizes (mipmap-mdpi, mipmap-xxxhdpi, etc.).
5. Run your Gradle compilation again, and your app will feature your new icon!
