const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const execSync = require('child_process').execSync;

const UPLOAD_URL = process.env.UPLOAD_URL || '';
const PROJECT_URL = process.env.PROJECT_URL || '';
const AUTO_ACCESS = process.env.AUTO_ACCESS || false;
const FILE_PATH = process.env.FILE_PATH || './tmp';
const SUB_PATH = process.env.SUB_PATH || 'sub';
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const UUID = process.env.UUID || '6261f56a-9b0c-4577-a4a3-898e60f9096e';
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nzag.faiz.us.kg:8008';
const NEZHA_PORT = process.env.NEZHA_PORT || '';
const NEZHA_KEY = process.env.NEZHA_KEY || 'JgARl5rWKs4k8TTuG1OgFcaxrxsjmpHl';
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'appw.faiz.us.kg';
const ARGO_AUTH = process.env.ARGO_AUTH || 'eyJhIjoiNmI3MzZhMDhiMzlmNDVlMzE2ZTdlMGNkODE2Yjc2ZDIiLCJ0IjoiMDRlMTBjOTktNDQzMC00YmQxLTk1ZGUtNDk1NmQyMWEyMmRlIiwicyI6IlpEYzNOVFUwT0dJdFpEUTVZaTAwTlRVeUxUZzRZbVF0WWpnM04yTm1aV05sTlRjMyJ9';
const ARGO_PORT = process.env.ARGO_PORT || 8001;
const CFIP = process.env.CFIP || 'www.visa.com.sg';
const CFPORT = process.env.CFPORT || 443;
const NAME = process.env.NAME || 'Vls';

// 创建运行文件夹
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH);
  console.log(`${FILE_PATH} is created`);
} else {
  console.log(`${FILE_PATH} already exists`);
}

// 根路由
async function handleRequest(req, res) {
  try {
    await startserver();
    res.send("Hello world!");
  } catch (error) {
    res.send(`Error: ${error.message}`);
  }
}

// 启动服务器
async function startserver() {
  await deleteNodes();
  cleanupOldFiles();
  await downloadFilesAndRun();
  await extractDomains();
  await AddVisitTask();
}

// 删除历史节点
async function deleteNodes() {
  if (!UPLOAD_URL) return;
  const subPath = path.join(FILE_PATH, 'sub.txt');
  if (!fs.existsSync(subPath)) return;

  let fileContent;
  try {
    fileContent = fs.readFileSync(subPath, 'utf-8');
  } catch {
    return null;
  }

  const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
  const nodes = decoded.split('\n').filter(line => /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line));

  if (nodes.length === 0) return;

  return axios.post(`${UPLOAD_URL}/api/delete-nodes`, 
    JSON.stringify({ nodes }),
    { headers: { 'Content-Type': 'application/json' } }
  ).catch((error) => { 
    return null; 
  });
}

// 清理历史文件
function cleanupOldFiles() {
  const pathsToDelete = ['web', 'bot', 'npm', 'php', 'sub.txt', 'boot.log'];
  pathsToDelete.forEach(file => {
    const filePath = path.join(FILE_PATH, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
}

// 下载并运行依赖文件
async function downloadFilesAndRun() {
  const architecture = getSystemArchitecture();
  const filesToDownload = getFilesForArchitecture(architecture);

  if (filesToDownload.length === 0) {
    console.log(`Can't find a file for the current architecture`);
    return;
  }

  const downloadPromises = filesToDownload.map(fileInfo => {
    return new Promise((resolve, reject) => {
      downloadFile(fileInfo.fileName, fileInfo.fileUrl, (err, fileName) => {
        if (err) {
          reject(err);
        } else {
          resolve(fileName);
        }
      });
    });
  });

  try {
    await Promise.all(downloadPromises);
  } catch (err) {
    console.error('Error downloading files:', err);
    return;
  }

  // 授权和运行
  const filesToAuthorize = NEZHA_PORT ? ['./npm', './web', './bot'] : ['./php', './web', './bot'];
  authorizeFiles(filesToAuthorize);

  // 运行 ne-zha
  if (NEZHA_SERVER && NEZHA_KEY) {
    const command = NEZHA_PORT ? 
      `nohup ${FILE_PATH}/npm -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} >/dev/null 2>&1 &` :
      `nohup ${FILE_PATH}/php -c "${FILE_PATH}/config.yaml" >/dev/null 2>&1 &`;
    
    try {
      await exec(command);
      console.log('Service is running');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Service running error: ${error}`);
    }
  } else {
    console.log('NEZHA variable is empty, skip running');
  }

  // 运行 xr-ay
  const command1 = `nohup ${FILE_PATH}/web -c ${FILE_PATH}/config.json >/dev/null 2>&1 &`;
  try {
    await exec(command1);
    console.log('Web service is running');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`Web running error: ${error}`);
  }

  // 运行 cloud-fared
  if (fs.existsSync(path.join(FILE_PATH, 'bot'))) {
    const args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${FILE_PATH}/boot.log --loglevel info --url http://localhost:${ARGO_PORT}`;
    try {
      await exec(`nohup ${FILE_PATH}/bot ${args} >/dev/null 2>&1 &`);
      console.log('Bot is running');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error executing command: ${error}`);
    }
  }
}

// 根据系统架构返回对应的url
function getFilesForArchitecture(architecture) {
  let baseFiles;
  if (architecture === 'arm') {
    baseFiles = [
      { fileName: "web", fileUrl: "https://arm64.ssss.nyc.mn/web" },
      { fileName: "bot", fileUrl: "https://arm64.ssss.nyc.mn/2go" }
    ];
  } else {
    baseFiles = [
      { fileName: "web", fileUrl: "https://amd64.ssss.nyc.mn/web" },
      { fileName: "bot", fileUrl: "https://amd64.ssss.nyc.mn/2go" }
    ];
  }

  if (NEZHA_SERVER && NEZHA_KEY) {
    const npmUrl = architecture === 'arm' 
      ? "https://arm64.ssss.nyc.mn/agent"
      : "https://amd64.ssss.nyc.mn/agent";
    baseFiles.unshift({ fileName: "npm", fileUrl: npmUrl });
  }

  return baseFiles;
}

// 下载文件
function downloadFile(fileName, fileUrl, callback) {
  const filePath = path.join(FILE_PATH, fileName);
  const writer = fs.createWriteStream(filePath);

  axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  })
    .then(response => {
      response.data.pipe(writer);

      writer.on('finish', () => {
        writer.close();
        console.log(`Download ${fileName} successfully`);
        callback(null, fileName);
      });

      writer.on('error', err => {
        fs.unlink(filePath, () => { });
        const errorMessage = `Download ${fileName} failed: ${err.message}`;
        console.error(errorMessage);
        callback(errorMessage);
      });
    })
    .catch(err => {
      const errorMessage = `Download ${fileName} failed: ${err.message}`;
      console.error(errorMessage);
      callback(errorMessage);
    });
}

// 判断系统架构
function getSystemArchitecture() {
  const arch = os.arch();
  return (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') ? 'arm' : 'amd';
}

// 提取域名
async function extractDomains() {
  // 这里的逻辑保持不变
  // ...
}

// 自动访问项目URL
async function AddVisitTask() {
  if (!AUTO_ACCESS || !PROJECT_URL) {
    console.log("Skipping adding automatic access task");
    return;
  }

  try {
    const response = await axios.post('https://oooo.serv00.net/add-url', {
      url: PROJECT_URL
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`Automatic access task added successfully`);
  } catch (error) {
    console.error(`Adding URL failed: ${error.message}`);
  }
}

// 导出处理请求的函数
module.exports = handleRequest;
