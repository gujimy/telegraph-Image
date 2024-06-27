export async function onRequestPost(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const apikey = env.ModerateContentApiKey;
    const ModerateContentUrl = apikey ? `https://api.moderatecontent.com/moderate/?key=${apikey}&` : "";
    const ratingApi = env.RATINGAPI ? `${env.RATINGAPI}?` : ModerateContentUrl;
    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP");
    const Referer = request.headers.get('Referer') || "Referer";

    // 获取上传图片的文件名
    const contentDisposition = request.headers.get('Content-Disposition');
    let fileName = 'unknown';
    if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]*)"?/);
        if (match) {
            fileName = match[1];
        }
    }

    const res_img = await fetch('https://telegra.ph/' + url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
    });

    const options = {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const timedata = new Date();
    const formattedDate = new Intl.DateTimeFormat('zh-CN', options).format(timedata);

    if (!env.IMG) {
        return res_img;
    } else {
        const responseData = await res_img.json();
        try {
            const rating = ratingApi ? await getRating(ratingApi, responseData[0].src) : { rating: 0 };
            const rating_index = rating.rating ? rating.rating : rating.rating_index;
            await insertImageData(env.IMG, responseData[0].src, fileName, Referer, clientIP, rating_index, formattedDate);
        } catch (e) {
            console.log(e);
            await insertImageData(env.IMG, responseData[0].src, fileName, Referer, clientIP, 5, formattedDate);
        }

        return Response.json(responseData);
    }
}

async function getRating(ratingApi, src) {
    const res = await fetch(`${ratingApi}url=https://telegra.ph${src}`);
    return await res.json();
}

async function insertImageData(env, src, fileName, referer, ip, rating, time) {
    try {
        const instdata = await env.prepare(
            `INSERT INTO imginfo (url, filename, referer, ip, rating, total, time)
             VALUES ('${src}', '${fileName}', '${referer}', '${ip}', ${rating}, 1, '${time}')`
        ).run();
    } catch (error) {
        console.log(error);
    }
}
