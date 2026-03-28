# Bird (MessageBird) email setup

Use Bird for sending agreement emails instead of Resend.

## 1. Get credentials

1. Sign in at [bird.com](https://bird.com) (or messagebird.com).
2. **Access key**: User Settings → Security → Access Keys → Add new access key (role: Application Developer).
3. **Workspace ID**: User Settings → Organization → Workspaces → open your workspace, copy Workspace ID.
4. **Email channel**: Manage Channels → Email → Install Email. Add your domain, verify DNS, then copy the **Channel ID** from the channel settings.

## 2. Vercel environment variables

In your Vercel project (Project Settings → Environment Variables), set:

| Variable | Value |
|----------|--------|
| `EMAIL_PROVIDER` | `bird` |
| `BIRD_ACCESS_KEY` | Your Bird access key |
| `BIRD_WORKSPACE_ID` | Your workspace UUID |
| `BIRD_CHANNEL_ID` | Your email channel UUID |

Optional: `BIRD_FROM` for the "from" address (e.g. `Pricer <quotes@herculesmovingsolutions.com>`).

## 3. Deploy

Redeploy (e.g. push to `main`) so the serverless function uses the new env vars. Send Agreement will then send via Bird.

## Switch back to Resend

Set `EMAIL_PROVIDER` to `resend` (or remove it and ensure `RESEND_API_KEY` is set). Redeploy.
