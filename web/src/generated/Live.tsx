// Generated from screens/Live.aui; edit the AUI source.
import { Alert, Badge, Button, Card, Field, Heading, Input, Page, Section, Stack, Text } from "@/components/ui"

export function Live({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Stack variant="standard-page">
        <Text variant="eyebrow">IN THE MOMENT</Text>
        <Heading level={1}>LIVE</Heading>
        {data.active ? (
          <>
            <Section id="live-player" />
            <Alert>{data.status}</Alert>
            <Button onClick={() => onAction("endLive")} variant="danger">Leave live</Button>
          </>
        ) : (
          <>
            <Card>
              <Heading level={2}>Go live with your community</Heading>
              <Text>Share your camera and microphone with up to 8 viewers. Internet connections may need your server's TURN configuration.</Text>
              <Field label="Live title"><Input name="liveTitle" placeholder="What’s happening?" /></Field>
              <Button onClick={() => onAction("startLive")} variant="create">Go LIVE</Button>
            </Card>
            {data.rooms.map((item, i) => (
              <Card key={i}>
                <Badge tone="accent">LIVE</Badge>
                <Heading level={2}>{item.title}</Heading>
                <Text>{item.handle}</Text>
                <Button onClick={() => onAction("joinLive")} item={item.id} variant="secondary">Watch live</Button>
              </Card>
            ))}
            {data.empty && (
              <Text variant="empty">No one is live right now.</Text>
            )}
          </>
        )}
      </Stack>
    </Page>
  )
}
