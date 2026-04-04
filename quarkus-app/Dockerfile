####
# This Dockerfile is used to build a JVM-based container image for the Quarkus application
# with Instana Java agent integration
####
FROM registry.access.redhat.com/ubi8/openjdk-17:1.18

ENV LANGUAGE='en_US:en'

# Install Instana Java Agent
USER root
RUN mkdir -p /opt/instana && \
    curl -o /opt/instana/instana-agent.jar https://github.com/instana/instana-agent-java/releases/latest/download/instana-agent.jar && \
    chmod 644 /opt/instana/instana-agent.jar

USER 185

# Copy application files
COPY --chown=185 target/quarkus-app/lib/ /deployments/lib/
COPY --chown=185 target/quarkus-app/*.jar /deployments/
COPY --chown=185 target/quarkus-app/app/ /deployments/app/
COPY --chown=185 target/quarkus-app/quarkus/ /deployments/quarkus/

# Set JVM options for memory leak detection and Instana
ENV JAVA_OPTS="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager -Xmx512m -Xms256m"
ENV JAVA_APP_JAR="/deployments/quarkus-run.jar"

# Instana agent configuration
ENV INSTANA_AGENT_JAR="/opt/instana/instana-agent.jar"
ENV JAVA_OPTS="${JAVA_OPTS} -javaagent:${INSTANA_AGENT_JAR}"

EXPOSE 8080
USER 185

ENTRYPOINT [ "java", "-jar", "/deployments/quarkus-run.jar" ]