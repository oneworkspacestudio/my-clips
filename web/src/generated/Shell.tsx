// Generated from screens/Shell.aui; edit the AUI source.
import { Alert, Button, Divider, Heading, Icon, Image, Input, Link, Page, Row, Section, Spacer, Spinner, Stack, Text } from "@/components/ui"

export function Shell({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Stack variant="sidebar">
        <Link href="#home" variant="brand">
          <Image src={data.logo} alt="My Clips" width={38} height={38} />
          <Heading level={2}>My Clips</Heading>
        </Link>
        <Row variant="searchbox">
          <Icon name="Search" />
          <Input name="search" placeholder="Search clips & people" onClick={() => onAction("search")} />
        </Row>
        {data.nav.map((item, i) => (
          <Link key={i} href={item.href} variant={item.variant}>
            <Icon name={item.icon} size={25} />
            <Text>{item.title}</Text>
          </Link>
        ))}
        <Divider />
        <Button variant="create" onClick={() => onAction("create")}>
          <Icon name="Plus" />
          <Text>Upload</Text>
        </Button>
        <Spacer />
        <Link href="#settings" variant="nav">
          <Icon name="Settings2" />
          <Text>Settings</Text>
        </Link>
        {data.workspace && (
          <Link href={data.workspace} variant="ecosystem">↖ One Workspace</Link>
        )}
        <Text variant="footnote">Your server. Your creativity.</Text>
        <Text variant="footnote">{data.versionText}</Text>
      </Stack>
      <Stack variant="workspace">
        {data.error && (
          <Alert tone="error">{data.error}</Alert>
        )}
        {data.notice && (
          <Alert tone="success">{data.notice}</Alert>
        )}
        {data.offline && (
          <Alert tone="warning">Offline · your device draft is safe. Reconnect to publish.</Alert>
        )}
        {data.busy && (
          <Row variant="progress">
            <Spinner />
            <Text>{data.busy}</Text>
          </Row>
        )}
        <Section id="screen-outlet" />
      </Stack>
      <Row variant="bottomnav">
        {data.mobileNav.map((item, i) => (
          <Link key={i} href={item.href} variant={item.variant} aria-label={item.title}>
            <Icon name={item.icon} size={23} />
            <Text>{item.title}</Text>
          </Link>
        ))}
      </Row>
    </Page>
  )
}
