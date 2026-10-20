// Generated from screens/Inbox.aui; edit the AUI source.
import { Button, Card, Divider, Heading, Icon, Input, Link, Page, Row, Spacer, Stack, Text } from "@/components/ui"

export function Inbox({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Stack variant="standard-page">
        <Row>
          <Heading level={1}>Inbox</Heading>
          <Spacer />
          <Button onClick={() => onAction("readAll")} variant="secondary">Mark all read</Button>
        </Row>
        <Text variant="caption">Likes, comments, follows and messages, as they happen.</Text>
        {data.events.map((item, i) => (
          <Row key={i} variant="notification">
            <Icon name={item.icon} />
            <Stack>
              <Text>{item.label}</Text>
              <Text variant="caption">{item.date}</Text>
            </Stack>
            <Spacer />
            <Button onClick={() => onAction("openEvent")} item={item.object} variant="secondary">Open</Button>
          </Row>
        ))}
        <Divider />
        <Heading level={2}>Messages</Heading>
        <Text variant="caption">Private conversations are available between mutual followers.</Text>
        {data.conversations.map((item, i) => (
          <Button key={i} onClick={() => onAction("message")} item={item.peer} variant="conversation">{item.label}</Button>
        ))}
        {data.conversation && (
          <Card>
            <Heading level={2}>{data.conversationTitle}</Heading>
            {data.messages.map((item, i) => (
              <Stack key={i} variant={item.variant}>
                <Text>{item.body}</Text>
                {item.href && (
                  <Link href={item.href}>View shared clip</Link>
                )}
                <Text variant="caption">{item.date}</Text>
              </Stack>
            ))}
            <Row>
              <Input name="message" placeholder="Write a message…" onClick={() => onAction("sendMessage")} />
              <Button onClick={() => onAction("sendMessage")} variant="create">Send</Button>
            </Row>
          </Card>
        )}
        {data.empty && (
          <Text variant="empty">You're all caught up.</Text>
        )}
      </Stack>
    </Page>
  )
}
