import * as admin from 'firebase-admin';
import * as Discord from 'discord.js';
import * as post from './postNow';

export default function listener(
    client: Discord.Client,
    database: admin.database.Database
): void {
    const lastExecuted = {
        guide: new Date(),
        news: new Date(),
    };
    database.ref('/decks_guide').on('child_changed', async () => {
        const currentTime = new Date();
        if (currentTime.valueOf() - lastExecuted.guide.valueOf() > 15000) {
            lastExecuted.guide = new Date();
            await post.postGuide(client, database);
        }
    });
    database.ref('/news').on('child_changed', async () => {
        const currentTime = new Date();
        if (currentTime.valueOf() - lastExecuted.news.valueOf() > 15000) {
            lastExecuted.news = new Date();
            await post.postNews(client, database);
        }
    });
}
