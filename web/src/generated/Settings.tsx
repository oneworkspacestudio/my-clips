// Generated from screens/Settings.aui; edit the AUI source.
import { Button, Card, Checkbox, Field, Heading, Input, Link, Page, Row, Select, Stack, Text } from "@/components/ui"

export function Settings({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Stack variant="standard-page">
        <Heading level={1}>Settings & privacy</Heading>
        <Card>
          <Heading level={2}>Your profile</Heading>
          <Field label="Handle"><Input name="handle" /></Field>
          <Field label="Bio"><Input name="bio" multiline={true} /></Field>
          <Checkbox name="private">Private account — approve new followers</Checkbox>
          <Button onClick={() => onAction("profileSave")}>Save profile</Button>
        </Card>
        <Card>
          <Heading level={2}>Notifications</Heading>
          <Text>Push requires HTTPS and browser support. On iPhone or iPad, install My Clips on your Home Screen first.</Text>
          <Checkbox name="push">Enable private push notifications</Checkbox>
          <Row>
            <Field label="Quiet hours start (server time)"><Input name="quietStart" type="time" /></Field>
            <Field label="Quiet hours end (server time)"><Input name="quietEnd" type="time" /></Field>
          </Row>
          <Button onClick={() => onAction("pushSave")}>Save notifications</Button>
          <Button onClick={() => onAction("testPush")} variant="secondary">Send test notification</Button>
        </Card>
        <Card>
          <Heading level={2}>Install My Clips</Heading>
          <Text>Add this app to your Home Screen for an app-like experience. On iOS, use Share → Add to Home Screen.</Text>
          <Button onClick={() => onAction("install")} variant="secondary">Install / show instructions</Button>
          {data.nativeAndroid && (
            <Link href="myclips://settings" variant="button">Android connection & notifications</Link>
          )}
          <Button onClick={() => onAction("updateApp")} variant="secondary">Apply available update</Button>
        </Card>
        <Card>
          <Heading level={2}>People & privacy</Heading>
          {data.relations.map((item, i) => (
            <Row key={i}>
              <Text>{item.label}</Text>
              <Button onClick={() => onAction("approve")} item={item.actor} variant="secondary">Approve request</Button>
              <Button onClick={() => onAction("reject")} item={item.actor} variant="secondary">Remove / reject</Button>
            </Row>
          ))}
          <Button onClick={() => onAction("export")} variant="secondary">Export my account & originals</Button>
          <Button onClick={() => onAction("logout")} variant="secondary">Sign out</Button>
          <Text>Disable this My Clips account and hide its posts. Protected originals remain for server retention and backups; your MyAccounts identity stays active.</Text>
          <Field label="Type DELETE MY CLIPS ACCOUNT to confirm"><Input name="deleteConfirmation" autocomplete="off" /></Field>
          <Button onClick={() => onAction("deleteAccount")} variant="danger">Disable My Clips account</Button>
        </Card>
        {data.owner && (
          <Card>
            <Heading level={2}>Community moderation</Heading>
            {data.reports.map((item, i) => (
              <Row key={i}>
                <Text>{item.reason}</Text>
                <Button onClick={() => onAction("removeReport")} item={item.id} variant="danger">Remove content</Button>
                <Button onClick={() => onAction("dismissReport")} item={item.id} variant="secondary">Dismiss</Button>
              </Row>
            ))}
          </Card>
        )}
        <Card>
          <Heading level={2}>Your feed</Heading>
          <Text>Recommendations learn from watches, skips, follows and hashtags. You can start fresh any time.</Text>
          <Button onClick={() => onAction("resetFeed")} variant="secondary">Reset recommendations</Button>
          <Field label="Playback quality"><Select name="quality" options={data.qualities} /></Field>
          <Checkbox name="dataSaver">Data saver</Checkbox>
          <Button onClick={() => onAction("savePlayback")} variant="secondary">Save playback preferences</Button>
        </Card>
        <Card>
          <Heading level={2}>Connected services</Heading>
          <Text>{data.storageText}</Text>
          <Text>{data.videoText}</Text>
          <Text>Default sounds by Kenney · CC0. My Music selections use your signed-in library access.</Text>
          <Link href="https://kenney.nl/assets/music-jingles" external={true}>Music credits</Link>
          <Text variant="caption">{data.identityText}</Text>
        </Card>
      </Stack>
    </Page>
  )
}
