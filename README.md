# osu-aggregator

This is basic downloader / crawler to get data required to make an Osu! mirror website.

It uses nodejs and mongodb. Storage of files is local (not in database).

Package include 
- a downloader: which downloads the files from official Osu! website (for images and mp3) and bloodcat (for osz files).
- a crawler: which crawl official website to get information not supported by current Osu! api like play count.

This is for the moment for my personal use to provide data to the website [Altosu](http://www.altosu.org/) but feel free to branch on it to use it for your own purpose.
