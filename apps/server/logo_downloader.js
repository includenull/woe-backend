import { readdir, rm, lstat, copyFile, writeFile } from 'fs/promises';
import { readFileSync, existsSync, createWriteStream } from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { join, extname } from 'path';
import { execFile } from 'child_process';
import logger from '@utils/logger.js';

const downloadDirectory = './tokens_logo';

const alcorRepoDownloadPath = downloadDirectory+'/tmp/alcor-ui';
const eoscafeRepoDownloadPath = downloadDirectory+'/tmp/eoscafe'

const alcorLogoDir = alcorRepoDownloadPath+'/assets/tokens/wax/'

async function downloadFile(url, destPath) {
  try {
  	logger.info('Download '+url+' to '+destPath)
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const destStream = createWriteStream(destPath, { flags: 'wx' });
  	await finished(Readable.fromWeb(response.body).pipe(destStream));

  } catch (error) {
    logger.error({ err: error }, 'Error downloading file');
  }
}

async function deleteDirectory(directoryPath) {
  try {
    const files = await readdir(directoryPath);

    // Loop through each file in the directory
    for (const file of files) {
      const filePath = join(directoryPath, file);
      const stats = await lstat(filePath);

      if (stats.isDirectory()) {
        // Recursively delete directories
        await deleteDirectory(filePath);
      } else {
        // Delete files
        await rm(filePath);
      }
    }

    // Delete the empty directory
    await rm(directoryPath, { recursive: true });

    logger.info(`Directory deleted: ${directoryPath}`);
  } catch (error) {
    logger.error({ err: error }, `Error deleting directory ${directoryPath}:`);
  }
}

function gitClone(repositoryUrl, outputPath) {
  return new Promise((resolve, reject) => {
  	logger.info('Cloning repository '+repositoryUrl)
    execFile('git', ['clone', repositoryUrl, outputPath], (error) => {
      if (error) {
        logger.error({ err: error }, 'Error executing git clone');
        reject(error);
        return;
      }

      logger.info(`Repository cloned successfully to: ${outputPath}`);
      resolve();
    });
  });
}

async function eosCafeCopyAndRenameFiles(repoDir, DESTDIR) {
	try {
		let tokensJson = readFileSync(repoDir + '/tokens.json', 'utf8');
		tokensJson = JSON.parse(tokensJson)
   	tokensJson = tokensJson.filter(t => 
    	t.chain === 'wax' && t.logo.substr(0, 68) === 'https://raw.githubusercontent.com/eoscafe/eos-airdrops/master/logos/'
  	);

  	for( const token of tokensJson) {
  		const filename = token.logo.substr(68)
  		const ticker = token.symbol;
	    const extension = extname(filename);
	    const contract = token.account;

	    const dest_file = contract.toLowerCase() + '_' + ticker.toLowerCase() + extension
      const sourcePath = join(repoDir+'/logos/', filename);
      const destPath = join(DESTDIR, dest_file);
      
      await copyFile(sourcePath, destPath);
      logger.info(`File copied and renamed: ${filename}`);
  	}
	}
	catch(error) {
		logger.error({ err: error }, 'Error:');
	}
}

async function alcorCopyAndRenameFiles(logoDir, DESTDIR) {
  try {
    // Read the files in logoDir
    const files = await readdir(logoDir);
    logger.info(files)

    // Loop through each file
    for (const file of files) {
      // Construct the full paths for source and destination
      const filename = file.split('_')
      if (filename.length < 2) continue;

	    const ticker = filename[0];
	    const extension = extname(filename[1]);
	    const contract = filename[1].slice(0, - extension.length); // Join remaining parts after the first one

	    const dest_file = contract.toLowerCase() + '_' + ticker.toLowerCase() + extension

      const sourcePath = join(logoDir, file);
      const destPath = join(DESTDIR, dest_file);

      // Copy the file to the destination
      await copyFile(sourcePath, destPath);

      logger.info(`File copied and renamed: ${file}`);
    }

    logger.info('All files copied and renamed successfully.');
  } catch (error) {
    logger.error({ err: error }, 'Error:');
  }
}

async function neftyLogosApi(DESTDIR) {
	const resp = await fetch('https://rates.neftyblocks.com/api/logos/wax');
	const tokens = await resp.json();
	for(const token in tokens) {
		const ticker = token.split('@')[0]
		const contract = token.split('@')[1]

		const dest_file = contract.toLowerCase() + '_' + ticker.toLowerCase()+'.png'
		const destPath = join(DESTDIR, dest_file);

		if(!existsSync(destPath)) {
			await downloadFile(tokens[token].logo, destPath)
		}
	}
}

const main = async () => {
	await deleteDirectory(alcorRepoDownloadPath);
	await deleteDirectory(eoscafeRepoDownloadPath);
	
	await gitClone('https://github.com/eoscafe/eos-airdrops.git', eoscafeRepoDownloadPath);
	await gitClone('https://github.com/avral/alcor-ui.git', alcorRepoDownloadPath);

	await eosCafeCopyAndRenameFiles(eoscafeRepoDownloadPath, downloadDirectory);
	await alcorCopyAndRenameFiles(alcorLogoDir, downloadDirectory);
	await neftyLogosApi(downloadDirectory)
}
main();

/* const getImageName = (token) => {
	return token.contract.toLowerCase() + '_' + token.ticker.toLowerCase() + '.png'
}

const downloadImage = async(downloadUrl, imageName) => {
  try {
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
    });
    response.data.pipe(fs.createWriteStream(downloadDirectory+'/'+imageName));
    return true;
  } catch (err) {
  	logger.error(`An error occurred while downloading image ${imageName}: HTTP ${err.response.status} ${err.response.statusText}`);
    return false;
  }
}

const alcorDownloadTokenImage = async(token) => {
	const alcorBaseUrl = 'https://raw.githubusercontent.com/avral/alcor-ui/master/assets/tokens/wax/'
	const fullUrl = alcorBaseUrl + token.ticker.toLowerCase()+'_'+token.contract.toLowerCase()+'.png'
	const imgDownloaded = await downloadImage(fullUrl, getImageName(token))
	logger.info('alcor '+imgDownloaded+' '+fullUrl)
	return imgDownloaded

}
const tacoDownloadTokenImage = async(token) => {
	const tacoBaseUrl = 'https://assets.tacostudios.io/tokens/'
	const fullUrl = tacoBaseUrl + token.contract.toLowerCase()+'_'+token.ticker.toUpperCase()+'.png'
	const imgDownloaded = await downloadImage(fullUrl, getImageName(token))
	logger.info('taco '+imgDownloaded+' '+fullUrl)
	return imgDownloaded
}
const defiboxDownloadTokenImage = async(token) => {
  const defiboxBaseUrl = ' https://defiboxwax.s3.ap-northeast-1.amazonaws.com/eos/'
  const fullUrl = defiboxBaseUrl + token.contract.toLowerCase()+'-'+token.ticker.toLowerCase()+'.png'
  const imgDownloaded = await downloadImage(fullUrl, getImageName(token))
  logger.info('defibox '+imgDownloaded+' '+fullUrl)
	return imgDownloaded
}

const downloadTokenImage = async(token) => {
	/** 
	 * Priority :
	 * 	1/ Check if image is available on alcor
	 * 	2/ Check if image is available on taco
	 *  3/ Last try defibox
	 *  4/ Do not check on eoscafe, source might be not trustable
	*//*
	let imgDownloaded = false
	imgDownloaded = await alcorDownloadTokenImage(token)

	if(!imgDownloaded)
		imgDownloaded = await tacoDownloadTokenImage(token)

	if(!imgDownloaded)
		imgDownloaded = await defiboxDownloadTokenImage(token)

	if(!imgDownloaded)
		logger.info('No image found for '+getImageName(token))
}

const main = async() => {
	let alcorPools = await AlcorPool.fetchPools(true)
	let defiboxPools = await DefiboxPool.fetchPools(true)
	let tacoPools = await TacoPool.fetchPools(true)

	const pools = alcorPools.concat(defiboxPools.concat(tacoPools))

	let tokens = []
	for(let i = 0; i < pools.length; ++i) {
		const token0 = {
			contract: pools[i].token0.contract,
			ticker: pools[i].token0.symbol.ticker
		}
		const token1 = {
			contract: pools[i].token1.contract,
			ticker: pools[i].token1.symbol.ticker
		}

		if(tokens.findIndex(t => t.contract === token0.contract && t.ticker === token0.ticker) === -1)
			tokens.push(token0)

		if(tokens.findIndex(t => t.contract === token1.contract && t.ticker === token1.ticker) === -1)
			tokens.push(token1)
	}

	let alcorMarkets = await AlcorMarket.fetchMarkets()
	for(const market of alcorMarkets) {
		const token0 = {
			contract: market.token0.contract,
			ticker: market.token0.symbol.ticker
		}

		const token1 = {
			contract: market.token1.contract,
			ticker: market.token1.symbol.ticker
		}

		if(tokens.findIndex(t => t.contract === token0.contract && t.ticker === token0.ticker) === -1)
			tokens.push(token0)

		if(tokens.findIndex(t => t.contract === token1.contract && t.ticker === token1.ticker) === -1)
			tokens.push(token1)
	}

	for(let i = 0; i < tokens.length; ++i) {
	  // Check if image already exists in download directory
	  if (!fs.existsSync(downloadDirectory+'/'+getImageName(tokens[i]))) {
	    // Image doesn't exist, download it
	    logger.info('Downloading '+tokens[i].contract+' '+tokens[i].ticker+' token image...');
	    await downloadTokenImage(tokens[i])
	    await delay(1000)
	  }
	}
}

main() */