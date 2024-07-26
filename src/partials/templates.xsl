<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

	<xsl:template name="tree">
		<xsl:for-each select="./*">
			<xsl:call-template name="tree-leaf"/>
		</xsl:for-each>
	</xsl:template>


	<xsl:template name="tree-leaf">
		<div class="leaf">
			<xsl:if test="@state = 'expanded'">
				<xsl:attribute name="data-state">expanded</xsl:attribute>
			</xsl:if>
			<i class="icon-arrow">
				<xsl:if test="@leaf = 'end'">
					<xsl:attribute name="class">icon-blank</xsl:attribute>
				</xsl:if>
			</i>
			<i><xsl:attribute name="class"><xsl:call-template name="leaf-icon"/></xsl:attribute></i>
			<span class="name"><i><xsl:value-of select="@name"/></i></span>
		</div>
		<xsl:if test="@state = 'expanded' and count(./*) &gt; 0">
		<div class="children">
			<xsl:call-template name="tree"/>
		</div>
		</xsl:if>
	</xsl:template>


	<xsl:template name="leaf-icon">
		<xsl:choose>
			<xsl:when test="@type = 'server'">icon-server</xsl:when>
			<xsl:when test="@type = 'database'">icon-database</xsl:when>
			<xsl:when test="@type = 'table'">icon-table</xsl:when>
			<xsl:when test="@type = 'database'">icon-database</xsl:when>
			<xsl:when test="@type = 'column'">icon-column</xsl:when>
			<xsl:otherwise>icon-blank</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

</xsl:stylesheet>