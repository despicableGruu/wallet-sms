import express, { type NextFunction, type Request, type Response } from 'express'
import axios from 'axios'
import { StatusCodes } from 'http-status-codes'
import { pickBy } from 'lodash-es'
import { TelegramClient, Api, password as Password } from 'telegram'
import config from '../config.ts'
import { sendMessage } from '../src/client.ts'

const router = express.Router()

const AxiosBase = axios.create({ timeout: 15000 })

async function isFromController (req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!config.controller.whitelistIps.includes(req.clientIp ?? '*')) {
    console.error(`[isFromController] Access denied for ip ${req.clientIp}`)
    res.status(StatusCodes.UNAUTHORIZED).json({ error: 'ip disallowed' })
    return
  }
  const secret = req.header('x-sms-wallet-secret')
  if (config.controller.secret.length > 0 && secret !== config.controller.secret) {
    console.error(`[isFromController] Access denied for secret ${secret}`)
    res.status(StatusCodes.UNAUTHORIZED).json({ error: 'bad secret' })
    return
  }
  next()
}

router.get('/health', async (req, res) => {
  console.log('[/health]', JSON.stringify(req.fingerprint))
  res.send('OK').end()
})

interface MsgRequest {
  body: string
  id: string
}

router.post('/msg', isFromController, async (req, res) => {
  const { body, id } = req.body as MsgRequest
  if (!body || !id) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'need id, body', body, id })
  }
  try {
    await sendMessage(id, body)
  } catch (ex: any) {
    console.error(ex)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: ex.toString() })
  }
})

// router.get('/')

export default router
