// Generated from screens/Sheet.aui; edit the AUI source.
import { Button, Card, Checkbox, Field, Heading, Icon, Input, Link, Page, Row, Section, Spacer, Stack, Text } from "@/components/ui"

export function Sheet({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Card variant="dialog">
        <Row>
          <Heading level={2}>{data.title}</Heading>
          <Spacer />
          <Button onClick={() => onAction("closeSheet")} variant="icon" cancel={true} aria-label="Close"><Icon name="X" /></Button>
        </Row>
        {data.commentsMode && (
          <>
            <Stack variant="comment-list">
              {data.comments.map((item, i) => (
                <Row key={i} variant="comment">
                  <Text variant="avatar">{item.initials}</Text>
                  <Stack>
                    <Text variant="creator">{item.handle}</Text>
                    <Text>{item.body}</Text>
                  </Stack>
                </Row>
              ))}
            </Stack>
            <Row>
              <Input name="comment" placeholder="Add a comment…" onClick={() => onAction("sendComment")} />
              <Button onClick={() => onAction("sendComment")} variant="create">Post</Button>
            </Row>
          </>
        )}
        {data.moreMode && (
          <>
            <Text>{data.reason}</Text>
            <Button onClick={() => onAction("hideClip")} variant="secondary">Not interested</Button>
            <Button onClick={() => onAction("duet")} variant="secondary">Duet</Button>
            <Button onClick={() => onAction("stitch")} variant="secondary">Stitch</Button>
            <Button onClick={() => onAction("report")} variant="secondary">Report clip</Button>
            <Field label="Report reason"><Input name="reportReason" placeholder="Tell us what happened" /></Field>
            {data.owned && (
              <>
                <Button onClick={() => onAction("archive")} variant="secondary">Archive</Button>
                <Button onClick={() => onAction("deleteClip")} variant="danger">Delete clip</Button>
              </>
            )}
          </>
        )}
        {data.musicMode && (
          <>
            <Text>Choose a sound from your signed-in My Music library.</Text>
            <Link href="/_workspace/open/music" external={true}>Open My Music to sign in</Link>
            <Row>
              <Input name="musicQuery" placeholder="Search your music…" onClick={() => onAction("searchMusic")} />
              <Button onClick={() => onAction("searchMusic")} variant="secondary">Search</Button>
            </Row>
            <Checkbox name="audioRights">I have permission to use this music in my videos</Checkbox>
            {data.music.map((item, i) => (
              <Row key={i}>
                <Stack>
                  <Text>{item.title}</Text>
                  <Text variant="caption">{item.artist}</Text>
                </Stack>
                <Button onClick={() => onAction("chooseMusic")} item={item.key} variant="secondary">Use sound</Button>
              </Row>
            ))}
          </>
        )}
        {data.cameraMode && (
          <>
            <Section id="camera-preview" />
            <Text>{data.recordStatus}</Text>
            <Row>
              <Button onClick={() => onAction("startCamera")} variant="secondary">Enable camera</Button>
              <Button onClick={() => onAction("switchCamera")} variant="secondary">Flip</Button>
              <Checkbox name="recordAudio">Microphone</Checkbox>
            </Row>
            <Row>
              <Button onClick={() => onAction("startRecording")} variant="create" disabled={data.recording}>Record</Button>
              <Button onClick={() => onAction("pauseRecording")} variant="secondary" disabled={data.notRecording}>Pause / resume</Button>
              <Button onClick={() => onAction("stopRecording")} variant="secondary" disabled={data.notRecording}>Finish</Button>
            </Row>
          </>
        )}
        {data.voiceMode && (
          <>
            <Text>Record a voiceover. It starts at the beginning of your clip.</Text>
            <Text>{data.recordStatus}</Text>
            <Row>
              <Button onClick={() => onAction("startVoice")} variant="create" disabled={data.recording}>Record voiceover</Button>
              <Button onClick={() => onAction("stopRecording")} variant="secondary" disabled={data.notRecording}>Finish</Button>
            </Row>
          </>
        )}
      </Card>
    </Page>
  )
}
